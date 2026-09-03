import { mergeLanguages, resolveProjectRepositories } from "@/server/generation/repository-matching";
import { collectPortfolioEvidence } from "@/server/github/evidence";
import { generatePortfolioDraft, type GeneratedPortfolioDraft } from "@/server/openai/portfolio-generator";
import type { PortfolioEvidence, PortfolioTone } from "@/server/openai/portfolio-prompt";
import { TEXT_LIMITS, clampText, clampTextArray } from "@/server/portfolio/content-limits";
import { buildHaystack, verifySkillGroups, verifyTechStack } from "@/server/portfolio/verification";
import { logOperationFailure } from "@/server/observability/api-logging";
import { getSupabaseClient } from "@/server/supabase/client";

type JobRecord = {
  id: string;
  user_id: string;
  repository_id: string;
  prompt: string;
  target_role: string | null;
  tone: PortfolioTone | null;
  highlights: unknown;
  status: string;
  portfolio_id: string | null;
  repository_analysis_id: string | null;
};

const JOB_COLUMNS =
  "id, user_id, repository_id, prompt, target_role, tone, highlights, status, portfolio_id, repository_analysis_id";

async function updateJob(jobId: string, values: Record<string, unknown>): Promise<void> {
  const { error } = await getSupabaseClient().from("generation_jobs").update(values).eq("id", jobId);
  if (error) throw new Error("Unable to update generation job.");
}

async function loadJob(jobId: string): Promise<JobRecord> {
  const { data, error } = await getSupabaseClient()
    .from("generation_jobs")
    .select(JOB_COLUMNS)
    .eq("id", jobId)
    .maybeSingle();
  if (error || !data) throw new Error("Generation job is unavailable.");
  return data as JobRecord;
}

/**
 * 더 진행할 이유가 없는 작업인지 본다.
 *
 * 실패도 포함한다. 앞 단계가 재시도 무의미한 실패로 끝났는데 다음 단계가 그대로
 * 이어지면, 근거가 없다는 다른 실패가 덧씌워져 원래 사유가 사라진다.
 */
function isFinished(job: JobRecord): boolean {
  return job.status === "completed" || job.status === "failed" || Boolean(job.portfolio_id);
}

// 사용자가 고른 순서를 그대로 돌려준다. 조인 테이블이 비어 있는 예전 작업은
// 대표 저장소 하나짜리로 본다.
async function readJobRepositoryIds(job: JobRecord): Promise<string[]> {
  const { data, error } = await getSupabaseClient()
    .from("generation_job_repositories")
    .select("repository_id, position")
    .eq("generation_job_id", job.id)
    .order("position", { ascending: true });
  if (error) throw new Error("Unable to load generation job repositories.");
  const links = (data ?? []) as Array<{ repository_id: string }>;
  return links.length > 0 ? links.map((link) => link.repository_id) : [job.repository_id];
}

type EvidenceRecord = {
  evidence: PortfolioEvidence;
  draft: GeneratedPortfolioDraft | null;
};

async function readEvidenceRecord(jobId: string): Promise<EvidenceRecord | null> {
  const { data, error } = await getSupabaseClient()
    .from("generation_evidence")
    .select("evidence, draft")
    .eq("generation_job_id", jobId)
    .maybeSingle();
  if (error) throw new Error("Unable to load generation evidence.");
  return data ? (data as EvidenceRecord) : null;
}

/**
 * 1단계. GitHub 근거를 모아 저장한다.
 *
 * 이미 모아둔 근거가 있으면 다시 읽지 않는다. 재시도가 GitHub 호출 한도를
 * 갉아먹지 않게 하고, 같은 작업이 매번 다른 근거로 생성되는 것도 막는다.
 */
export async function collectGenerationEvidence(jobId: string): Promise<void> {
  const job = await loadJob(jobId);
  if (isFinished(job)) return;
  if (await readEvidenceRecord(jobId)) return;

  const repositoryIds = await readJobRepositoryIds(job);
  await updateJob(jobId, {
    status: "processing",
    stage: "analyzing_repository",
    progress: 15,
    message: repositoryIds.length > 1
      ? `GitHub 저장소 ${repositoryIds.length}개를 분석하고 있습니다.`
      : "GitHub 저장소를 분석하고 있습니다.",
    error_code: null,
    error_message: null,
  });

  const evidence = await collectPortfolioEvidence(job.user_id, repositoryIds, {
    prompt: job.prompt,
    targetRole: job.target_role,
    tone: job.tone,
    highlights: Array.isArray(job.highlights)
      ? job.highlights.filter((value): value is string => typeof value === "string")
      : [],
  });

  const { error } = await getSupabaseClient()
    .from("generation_evidence")
    .upsert({ generation_job_id: jobId, evidence }, { onConflict: "generation_job_id" });
  if (error) throw new Error("Unable to persist generation evidence.");

  // 앞선 시도가 이미 분석을 남겼다면 그대로 쓴다. 같은 내용이 중복으로 쌓이지 않게.
  const analysisId = job.repository_analysis_id ?? (await insertRepositoryAnalyses(job, evidence));
  await updateJob(jobId, { repository_analysis_id: analysisId, progress: 40 });
}

/**
 * 2단계. 모델에게 초안을 받는다.
 *
 * 가장 비싼 단계다. 초안이 이미 있으면 다시 호출하지 않는다. 저장 단계가
 * 실패해 다시 돌아도 모델 호출이 반복되지 않는 이유가 이것이다.
 */
export async function generateGenerationDraft(jobId: string): Promise<void> {
  const job = await loadJob(jobId);
  if (isFinished(job)) return;

  const record = await readEvidenceRecord(jobId);
  if (!record) throw new Error("Generation evidence is unavailable.");
  if (record.draft) return;

  await updateJob(jobId, {
    stage: "generating_content",
    progress: 55,
    message: "포트폴리오 콘텐츠를 작성하고 있습니다.",
  });

  const draft = await generatePortfolioDraft(record.evidence);
  const { error } = await getSupabaseClient()
    .from("generation_evidence")
    .update({ draft })
    .eq("generation_job_id", jobId);
  if (error) throw new Error("Unable to persist generated draft.");
}

/**
 * 3단계. 결과를 포트폴리오로 저장한다.
 *
 * 포트폴리오는 generation_job_id로 upsert하므로 여러 번 돌아도 하나만 남는다.
 */
export async function persistGenerationPortfolio(jobId: string): Promise<void> {
  const job = await loadJob(jobId);
  if (job.status === "completed" || job.status === "failed") return;
  if (job.portfolio_id) {
    await markCompleted(jobId, job.portfolio_id);
    return;
  }

  const record = await readEvidenceRecord(jobId);
  if (!record?.draft) throw new Error("Generated draft is unavailable.");
  const { evidence, draft } = record;

  await updateJob(jobId, {
    stage: "rendering_portfolio",
    progress: 80,
    message: "포트폴리오 결과를 저장하고 있습니다.",
  });

  const { data: user, error: userError } = await getSupabaseClient().from("users")
    .select("display_name, email, avatar_url, profile_url").eq("id", job.user_id).maybeSingle();
  if (userError || !user) throw new Error("User profile is unavailable.");

  const projectRepositories = resolveProjectRepositories(draft.projects, evidence.repositories);
  const primaryRepository = evidence.repositories[0];

  /* 근거에 없는 기술은 걷어낸다. 프롬프트가 금지해도 모델은 종종 그럴듯한 이름을
     덧붙이고, 면접에서 설명하지 못할 한 줄이 남는 쪽이 더 큰 손해다. */
  const haystack = buildHaystack(evidence);
  const verifiedSkills = verifySkillGroups(draft.skills, evidence, haystack);
  const removedTech: string[] = [];
  const verifiedProjects = draft.projects.map((project) => {
    const techStack = verifyTechStack(project.techStack, evidence, haystack);
    removedTech.push(...techStack.removed);
    return { ...project, techStack: techStack.value };
  });
  const removed = [...verifiedSkills.removed, ...removedTech];
  if (removed.length > 0) {
    // 자주 일어나면 프롬프트를 고쳐야 한다는 신호다.
    logOperationFailure({
      domain: "generations",
      operation: "draft.unsupported_skills_removed",
      jobId,
      error: new Error(`Removed ${removed.length} unsupported items: ${removed.join(", ")}`),
    });
  }
  /* 분량 상한이 프롬프트 지시로만 있어 모델이 어기면 그대로 통과했다.
     저장 시점에 한 번 자른다. 읽을 때도 자르므로 규격 이전 데이터도 안전하다. */
  const content = {
    profile: {
      displayName: user.display_name,
      headline: clampText(draft.headline, TEXT_LIMITS.headline),
      targetRole: job.target_role || "개발자",
      avatarUrl: user.avatar_url,
    },
    introduction: clampText(draft.introduction, TEXT_LIMITS.introduction),
    skills: verifiedSkills.value,
    // repositoryName은 저장소를 되찾는 용도로만 쓰고 결과에는 담지 않는다.
    projects: verifiedProjects.map((project, index) => ({
      id: crypto.randomUUID(),
      title: project.title,
      description: clampText(project.description, TEXT_LIMITS.description),
      role: project.role,
      techStack: project.techStack,
      highlights: clampTextArray(project.highlights, TEXT_LIMITS.highlight),
      challenges: clampTextArray(project.challenges, TEXT_LIMITS.story),
      solutions: clampTextArray(project.solutions, TEXT_LIMITS.story),
      impact: clampTextArray(project.impact, TEXT_LIMITS.story),
      repositoryUrl: projectRepositories[index].url,
    })),
    gitAnalysis: {
      summary: primaryRepository.description || primaryRepository.name,
      primaryLanguage: primaryRepository.primaryLanguage,
      languages: mergeLanguages(evidence.repositories),
      starCount: evidence.repositories.reduce((total, repository) => total + repository.starCount, 0),
      forkCount: evidence.repositories.reduce((total, repository) => total + repository.forkCount, 0),
      notablePatterns: draft.notablePatterns,
      // 작업이 최근인지 보여주는 지표다. 여러 저장소 중 가장 최근 push를 쓴다.
      lastActivityAt: evidence.repositories
        .map((repository) => repository.pushedAt)
        .sort()
        .at(-1) ?? null,
    },
    contact: { githubUrl: user.profile_url, email: user.email, location: null },
  };

  const { data: portfolio, error: portfolioError } = await getSupabaseClient().from("portfolios").upsert({
    user_id: job.user_id,
    repository_id: primaryRepository.id,
    generation_job_id: jobId,
    title: draft.title,
    target_role: job.target_role || "개발자",
    content,
  }, { onConflict: "generation_job_id" }).select("id").single();
  if (portfolioError || !portfolio) throw new Error("Unable to persist generated portfolio.");

  const { error: linkError } = await getSupabaseClient().from("portfolio_repositories").upsert(
    evidence.repositories.map((repository, position) => ({
      portfolio_id: portfolio.id,
      repository_id: repository.id,
      position,
    })),
    { onConflict: "portfolio_id,repository_id" },
  );
  if (linkError) throw new Error("Unable to link portfolio repositories.");

  await markCompleted(jobId, portfolio.id);
}

async function markCompleted(jobId: string, portfolioId: string): Promise<void> {
  await updateJob(jobId, {
    status: "completed",
    stage: "completed",
    progress: 100,
    message: "포트폴리오가 완성되었습니다.",
    portfolio_id: portfolioId,
    completed_at: new Date().toISOString(),
  });
}

// 분석 기록은 저장소마다 남기고, 단일 FK인 job에는 대표 저장소 것만 연결한다.
async function insertRepositoryAnalyses(
  job: JobRecord,
  evidence: PortfolioEvidence,
): Promise<string> {
  const { data: analyses, error } = await getSupabaseClient().from("repository_analyses").insert(
    evidence.repositories.map((repository) => ({
      user_id: job.user_id,
      repository_id: repository.id,
      source_pushed_at: new Date().toISOString(),
      language_breakdown: repository.languages,
      commit_count: repository.ownCommits.length,
      pull_request_count: repository.ownPullRequests.length,
      summary: repository.description || repository.name,
    })),
  ).select("id, repository_id");
  if (error || !analyses?.length) throw new Error("Unable to persist repository analysis.");
  const primary = analyses.find((analysis) => analysis.repository_id === evidence.repositories[0].id) ?? analyses[0];
  return primary.id;
}

export async function markGenerationJobFailed(
  jobId: string,
  failure?: { code: string; message: string },
): Promise<void> {
  await updateJob(jobId, {
    status: "failed",
    stage: "failed",
    message: "포트폴리오를 만들지 못했어요.",
    error_code: failure?.code ?? "GENERATION_FAILED",
    error_message: failure?.message ?? "잠시 후 다시 시도해주세요.",
  });
}
