import { start } from "workflow/api";
import { getMockCreditSummary } from "@/server/billing/mock-catalog";
import { getRepository } from "@/server/github/repositories";
import { expireStaleJobs } from "@/server/generation/stale-jobs";
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

/* 크레딧은 아직 목이다. 값을 여기서 또 적어두면 목 설정과 화면이 조용히
   어긋난다. 단일 출처에서 파생시킨다. */
function buildQuote(repositoryCount: number) {
  const credits = getMockCreditSummary();
  return {
    currentBalance: credits.balance,
    repositoryCount,
    estimatedCost: repositoryCount * credits.costPerRepository,
    // chargingEnabled가 false인 동안에는 잔액이 줄지 않는다.
    balanceAfterGeneration: credits.balance,
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
    .select("id, repository_id, status, stage, progress, message, portfolio_id, error_code, error_message, created_at, updated_at, generation_job_repositories(repository_id, position)")
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

  /* 앞선 작업이 멈춘 채 남아 있으면 활성 작업 유니크 인덱스에 걸려 새 작업을
     만들 수 없다. 다시 시도하는 이 순간이 막힌 사용자를 풀어주기 좋은 지점이다. */
  await expireStaleJobs(userId);
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
    /* 작업 행만 남으면 활성 작업 유니크 인덱스 때문에 이 사용자는 다시 생성할 수
       없게 된다. 방금 넣은 행을 되돌린 뒤에 실패시킨다. */
    await getSupabaseClient().from("generation_jobs").delete().eq("id", data.id);
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
