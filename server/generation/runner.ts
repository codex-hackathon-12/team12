import { collectPortfolioEvidence } from "@/server/github/evidence";
import { generatePortfolioDraft } from "@/server/openai/portfolio-generator";
import { getSupabaseClient } from "@/server/supabase/client";

type JobRecord = {
  id: string;
  user_id: string;
  repository_id: string;
  prompt: string;
  target_role: string | null;
  highlights: unknown;
};

async function updateJob(jobId: string, values: Record<string, unknown>): Promise<void> {
  const { error } = await getSupabaseClient().from("generation_jobs").update(values).eq("id", jobId);
  if (error) throw new Error("Unable to update generation job.");
}

export async function runGenerationJob(jobId: string): Promise<void> {
  const { data, error } = await getSupabaseClient()
    .from("generation_jobs")
    .select("id, user_id, repository_id, prompt, target_role, highlights")
    .eq("id", jobId)
    .maybeSingle();
  if (error || !data) throw new Error("Generation job is unavailable.");
  const job = data as JobRecord;

  try {
    await updateJob(jobId, { status: "processing", stage: "analyzing_repository", progress: 15, message: "GitHub 저장소를 분석하고 있습니다.", error_code: null, error_message: null });
    const evidence = await collectPortfolioEvidence(job.user_id, job.repository_id, {
      prompt: job.prompt,
      targetRole: job.target_role,
      highlights: Array.isArray(job.highlights) ? job.highlights.filter((value): value is string => typeof value === "string") : [],
    });

    const { data: analysis, error: analysisError } = await getSupabaseClient().from("repository_analyses").insert({
      user_id: job.user_id,
      repository_id: job.repository_id,
      source_pushed_at: new Date().toISOString(),
      language_breakdown: evidence.languages,
      commit_count: evidence.commitTitles.length,
      pull_request_count: evidence.pullRequestTitles.length,
      summary: evidence.repository.description || evidence.repository.name,
    }).select("id").single();
    if (analysisError || !analysis) throw new Error("Unable to persist repository analysis.");

    await updateJob(jobId, { repository_analysis_id: analysis.id, stage: "generating_content", progress: 55, message: "포트폴리오 콘텐츠를 작성하고 있습니다." });
    const draft = await generatePortfolioDraft(evidence);
    const { data: user, error: userError } = await getSupabaseClient().from("users")
      .select("display_name, email, avatar_url, profile_url").eq("id", job.user_id).maybeSingle();
    if (userError || !user) throw new Error("User profile is unavailable.");

    await updateJob(jobId, { stage: "rendering_portfolio", progress: 80, message: "포트폴리오 결과를 저장하고 있습니다." });
    const content = {
      profile: { displayName: user.display_name, headline: draft.headline, targetRole: job.target_role || "개발자", avatarUrl: user.avatar_url },
      introduction: draft.introduction,
      skills: draft.skills,
      projects: draft.projects.map((project) => ({ id: crypto.randomUUID(), ...project, repositoryUrl: evidence.repository.url })),
      gitAnalysis: { summary: evidence.repository.description || evidence.repository.name, primaryLanguage: evidence.repository.primaryLanguage, languages: evidence.languages, starCount: evidence.repository.starCount, forkCount: evidence.repository.forkCount, notablePatterns: [] },
      contact: { githubUrl: user.profile_url, email: user.email, location: null },
    };
    const { data: portfolio, error: portfolioError } = await getSupabaseClient().from("portfolios").insert({
      user_id: job.user_id,
      repository_id: job.repository_id,
      generation_job_id: jobId,
      title: draft.title,
      target_role: job.target_role || "개발자",
      content,
    }).select("id").single();
    if (portfolioError || !portfolio) throw new Error("Unable to persist generated portfolio.");

    await updateJob(jobId, { status: "completed", stage: "completed", progress: 100, message: "포트폴리오가 완성되었습니다.", portfolio_id: portfolio.id, completed_at: new Date().toISOString() });
  } catch {
    await updateJob(jobId, { status: "failed", stage: "failed", message: "포트폴리오 생성에 실패했습니다.", error_code: "GENERATION_FAILED", error_message: "잠시 후 다시 시도해주세요." });
  }
}
