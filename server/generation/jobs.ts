import { start } from "workflow/api";
import { getRepository } from "@/server/github/repositories";
import { logOperationFailure } from "@/server/observability/api-logging";
import { getSupabaseClient } from "@/server/supabase/client";
import { generatePortfolioWorkflow } from "@/workflows/generate-portfolio";

type Input = {
  repositoryId: string;
  prompt: string;
  targetRole?: string;
  tone?: "professional" | "concise" | "storytelling";
  highlights?: string[];
  message?: string;
};

type RetrySourceJobRecord = {
  id: string;
  repository_id: string;
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

const quote = {
  currentBalance: 100,
  repositoryCount: 1,
  estimatedCost: 30,
  balanceAfterGeneration: 100,
  willCharge: false as const,
  isMock: true as const,
};

function toStage(value: string) {
  return value.replace(/_([a-z])/gu, (_, letter: string) => letter.toUpperCase());
}

function toDto(record: Record<string, unknown>) {
  const portfolio = record.portfolio as { resume_pdf_path: string | null } | null;
  return {
    jobId: record.id as string,
    repositoryId: record.repository_id as string,
    status: record.status as string,
    stage: toStage(record.stage as string),
    progress: record.progress as number,
    message: record.message as string,
    portfolioId: record.portfolio_id as string | null,
    resumePdfAvailable: Boolean(portfolio?.resume_pdf_path),
    creditQuote: quote,
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
    .select("id, repository_id, status, stage, progress, message, portfolio_id, error_code, error_message, created_at, updated_at, portfolio:portfolios!generation_jobs_portfolio_id_fkey(resume_pdf_path)")
    .eq("id", jobId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    throw new Error("Unable to load generation job.");
  }
  return data ? toDto(data as Record<string, unknown>) : null;
}

export async function createJob(userId: string, input: Input) {
  if (!(await getRepository(userId, input.repositoryId))) {
    return null;
  }
  const { data, error } = await getSupabaseClient()
    .from("generation_jobs")
    .insert({
      user_id: userId,
      repository_id: input.repositoryId,
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
    .select("id, repository_id, prompt, target_role, tone, highlights, status")
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
    repositoryId: source.repository_id,
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
