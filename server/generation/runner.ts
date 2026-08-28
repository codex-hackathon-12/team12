import { mergeLanguages, resolveProjectRepositories } from "@/server/generation/repository-matching";
import { collectPortfolioEvidence } from "@/server/github/evidence";
import { generatePortfolioDraft } from "@/server/openai/portfolio-generator";
import type { PortfolioTone } from "@/server/openai/portfolio-prompt";
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
};

async function updateJob(jobId: string, values: Record<string, unknown>): Promise<void> {
  const { error } = await getSupabaseClient().from("generation_jobs").update(values).eq("id", jobId);
  if (error) throw new Error("Unable to update generation job.");
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

export async function runGenerationJob(jobId: string): Promise<void> {
  const { data, error } = await getSupabaseClient()
    .from("generation_jobs")
    .select("id, user_id, repository_id, prompt, target_role, tone, highlights, status, portfolio_id")
    .eq("id", jobId)
    .maybeSingle();
  if (error || !data) throw new Error("Generation job is unavailable.");
  const job = data as JobRecord;

  if (job.status === "completed") {
    return;
  }

  if (job.portfolio_id) {
    await updateJob(jobId, { status: "completed", stage: "completed", progress: 100, message: "포트폴리오가 완성되었습니다.", completed_at: new Date().toISOString() });
    return;
  }

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
    highlights: Array.isArray(job.highlights) ? job.highlights.filter((value): value is string => typeof value === "string") : [],
  });

  // 분석 기록은 저장소마다 남기고, 단일 FK인 job에는 대표 저장소 것만 연결한다.
  const { data: analyses, error: analysisError } = await getSupabaseClient().from("repository_analyses").insert(
    evidence.repositories.map((repository) => ({
      user_id: job.user_id,
      repository_id: repository.id,
      source_pushed_at: new Date().toISOString(),
      language_breakdown: repository.languages,
      commit_count: repository.commitTitles.length,
      pull_request_count: repository.pullRequestTitles.length,
      summary: repository.description || repository.name,
    })),
  ).select("id, repository_id");
  if (analysisError || !analyses?.length) throw new Error("Unable to persist repository analysis.");
  const primaryAnalysis = analyses.find((analysis) => analysis.repository_id === evidence.repositories[0].id) ?? analyses[0];

  await updateJob(jobId, { repository_analysis_id: primaryAnalysis.id, stage: "generating_content", progress: 55, message: "포트폴리오 콘텐츠를 작성하고 있습니다." });
  const draft = await generatePortfolioDraft(evidence);
  const { data: user, error: userError } = await getSupabaseClient().from("users")
    .select("display_name, email, avatar_url, profile_url").eq("id", job.user_id).maybeSingle();
  if (userError || !user) throw new Error("User profile is unavailable.");

  await updateJob(jobId, { stage: "rendering_portfolio", progress: 80, message: "포트폴리오 결과를 저장하고 있습니다." });
  const projectRepositories = resolveProjectRepositories(draft.projects, evidence.repositories);
  const primaryRepository = evidence.repositories[0];
  const content = {
    profile: { displayName: user.display_name, headline: draft.headline, targetRole: job.target_role || "개발자", avatarUrl: user.avatar_url },
    introduction: draft.introduction,
    skills: draft.skills,
    // repositoryName은 저장소를 되찾는 용도로만 쓰고 결과에는 담지 않는다.
    projects: draft.projects.map((project, index) => ({
      id: crypto.randomUUID(),
      title: project.title,
      description: project.description,
      role: project.role,
      techStack: project.techStack,
      highlights: project.highlights,
      challenges: project.challenges,
      solutions: project.solutions,
      impact: project.impact,
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

  await updateJob(jobId, { status: "completed", stage: "completed", progress: 100, message: "포트폴리오가 완성되었습니다.", portfolio_id: portfolio.id, completed_at: new Date().toISOString() });
}

export async function markGenerationJobFailed(jobId: string): Promise<void> {
  await updateJob(jobId, {
    status: "failed",
    stage: "failed",
    message: "포트폴리오 생성에 실패했습니다.",
    error_code: "GENERATION_FAILED",
    error_message: "잠시 후 다시 시도해주세요.",
  });
}
