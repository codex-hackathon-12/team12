import { start } from "workflow/api";
import { getRepository } from "@/server/github/repositories";
import { logOperationFailure } from "@/server/observability/api-logging";
import { getSupabaseClient } from "@/server/supabase/client";
import { generatePortfolioWorkflow } from "@/workflows/generate-portfolio";

type Input = {
  repositoryIds: string[];
  prompt: string;
  targetRole?: string;
  tone?: "professional" | "concise" | "storytelling";
  highlights?: string[];
  message?: string;
};

type RetrySourceJobRecord = {
  id: string;
  repository_id: string;
  generation_job_repositories: Array<{ repository_id: string; position: number }> | null;
  prompt: string;
  target_role: string | null;
  tone: string | null;
  highlights: unknown;
  status: string;
};

export type RetryJobResult =
  | { kind: "not_found" }
  | { kind: "not_retryable" }
  | { kind: "created"; previousJobId: string; job: ReturnType<typeof toDto> };

export class ActiveGenerationError extends Error {}

function buildQuote(repositoryCount: number) {
  return {
    currentBalance: 100,
    repositoryCount,
    estimatedCost: repositoryCount * 30,
    balanceAfterGeneration: 100,
    willCharge: false as const,
    isMock: true as const,
  };
}

// position 순서가 사용자가 고른 순서이고, 그대로 프로젝트 순서가 된다.
function readRepositoryIds(record: Record<string, unknown>): string[] {
  const links = record.generation_job_repositories as
    | Array<{ repository_id: string; position: number }>
    | null
    | undefined;
  if (Array.isArray(links) && links.length > 0) {
    return [...links].sort((a, b) => a.position - b.position).map((link) => link.repository_id);
  }
  // 조인 테이블이 아직 채워지지 않은 예전 작업은 대표 저장소 하나로 본다.
  return [record.repository_id as string];
}

function toStage(value: string) {
  return value.replace(/_([a-z])/gu, (_, letter: string) => letter.toUpperCase());
}

function toDto(record: Record<string, unknown>) {
  const portfolio = record.portfolio as { resume_pdf_path: string | null } | null;
  const repositoryIds = readRepositoryIds(record);
  return {
    jobId: record.id as string,
    repositoryId: record.repository_id as string,
    repositoryIds,
    status: record.status as string,
    stage: toStage(record.stage as string),
    progress: record.progress as number,
    message: record.message as string,
    portfolioId: record.portfolio_id as string | null,
    resumePdfAvailable: Boolean(portfolio?.resume_pdf_path),
    creditQuote: buildQuote(repositoryIds.length),
    error: record.error_code
      ? { code: record.error_code, message: record.error_message || "생성에 실패했습니다.", retryable: record.status === "failed" }
      : null,
    createdAt: record.created_at as string,
    updatedAt: record.updated_at as string,
  };
}

export function isRetryableGenerationStatus(status: string): boolean {
  return status === "failed";
}

function toRetryTone(value: string | null): Input["tone"] {
  return value === "professional" || value === "concise" || value === "storytelling"
    ? value
    : undefined;
}

function toRetryHighlights(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

async function getJob(userId: string, jobId: string) {
  const { data, error } = await getSupabaseClient()
    .from("generation_jobs")
    .select("id, repository_id, status, stage, progress, message, portfolio_id, error_code, error_message, created_at, updated_at, generation_job_repositories(repository_id, position), portfolio:portfolios!generation_jobs_portfolio_id_fkey(resume_pdf_path)")
    .eq("id", jobId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    throw new Error("Unable to load generation job.");
  }
  return data ? toDto(data as Record<string, unknown>) : null;
}

export async function createJob(userId: string, input: Input) {
  if (input.repositoryIds.length === 0) {
    return null;
  }
  // 하나라도 사용자 소유가 아니면 작업을 만들지 않는다.
  const repositories = await Promise.all(
    input.repositoryIds.map((repositoryId) => getRepository(userId, repositoryId)),
  );
  if (repositories.some((repository) => !repository)) {
    return null;
  }

  const { data, error } = await getSupabaseClient()
    .from("generation_jobs")
    .insert({
      user_id: userId,
      repository_id: input.repositoryIds[0],
      prompt: input.prompt,
      target_role: input.targetRole || null,
      tone: input.tone || null,
      highlights: input.highlights || [],
      message: input.message ?? "생성 요청을 접수했습니다.",
    })
    .select("id")
    .single();
  if (error?.code === "23505") {
    throw new ActiveGenerationError();
  }
  if (error || !data) {
    throw new Error("Unable to create generation job.");
  }

  const { error: linkError } = await getSupabaseClient()
    .from("generation_job_repositories")
    .insert(input.repositoryIds.map((repositoryId, position) => ({
      generation_job_id: data.id,
      repository_id: repositoryId,
      position,
    })));
  if (linkError) {
    throw new Error("Unable to link generation job repositories.");
  }

  try {
    const workflow = await start(generatePortfolioWorkflow, [data.id]);
    await getSupabaseClient().from("generation_jobs").update({ workflow_instance_id: workflow.runId }).eq("id", data.id);
  } catch (error) {
    logOperationFailure({
      domain: "generations",
      operation: "workflow.start",
      jobId: data.id,
      error,
    });
    await getSupabaseClient()
      .from("generation_jobs")
      .update({ status: "failed", stage: "failed", error_code: "GENERATION_FAILED", error_message: "생성 작업을 시작하지 못했습니다." })
      .eq("id", data.id);
  }
  return getJob(userId, data.id);
}

export async function retryJob(userId: string, jobId: string): Promise<RetryJobResult> {
  const { data, error } = await getSupabaseClient()
    .from("generation_jobs")
    .select("id, repository_id, prompt, target_role, tone, highlights, status, generation_job_repositories(repository_id, position)")
    .eq("id", jobId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to load generation job for retry.");
  }

  if (!data) {
    return { kind: "not_found" };
  }

  const source = data as RetrySourceJobRecord;
  if (!isRetryableGenerationStatus(source.status)) {
    return { kind: "not_retryable" };
  }

  const job = await createJob(userId, {
    repositoryIds: readRepositoryIds(data as Record<string, unknown>),
    prompt: source.prompt,
    targetRole: source.target_role ?? undefined,
    tone: toRetryTone(source.tone),
    highlights: toRetryHighlights(source.highlights),
    message: "재시도 요청을 접수했습니다.",
  });

  if (!job) {
    throw new Error("Retry generation repository is unavailable.");
  }

  return { kind: "created", previousJobId: source.id, job };
}

export { getJob };
