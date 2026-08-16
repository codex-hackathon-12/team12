import { env } from "cloudflare:workers";
import { getRepository } from "@/server/github/repositories";
import { getSupabaseClient } from "@/server/supabase/client";

type Input = {
  repositoryId: string;
  prompt: string;
  targetRole?: string;
  tone?: "professional" | "concise" | "storytelling";
  highlights?: string[];
};

type WorkflowBinding = {
  create(options: { params: { jobId: string } }): Promise<{ id: string }>;
};

type WorkflowEnv = { GENERATION_WORKFLOW?: WorkflowBinding };

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
  const portfolios = record.portfolios as { resume_pdf_path: string | null }[] | null;
  return {
    jobId: record.id as string,
    repositoryId: record.repository_id as string,
    status: record.status as string,
    stage: toStage(record.stage as string),
    progress: record.progress as number,
    message: record.message as string,
    portfolioId: record.portfolio_id as string | null,
    resumePdfAvailable: Boolean(portfolios?.[0]?.resume_pdf_path),
    creditQuote: quote,
    error: record.error_code
      ? { code: record.error_code, message: record.error_message || "생성에 실패했습니다.", retryable: record.status === "failed" }
      : null,
    createdAt: record.created_at as string,
    updatedAt: record.updated_at as string,
  };
}

async function getJob(userId: string, jobId: string) {
  const { data, error } = await getSupabaseClient()
    .from("generation_jobs")
    .select("id, repository_id, status, stage, progress, message, portfolio_id, error_code, error_message, created_at, updated_at, portfolios(resume_pdf_path)")
    .eq("id", jobId)
    .eq("user_id", userId)
    .maybeSingle();
  return error || !data ? null : toDto(data as Record<string, unknown>);
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
      message: "생성 요청을 접수했습니다.",
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
    const workflow = (env as WorkflowEnv).GENERATION_WORKFLOW;
    if (!workflow) {
      throw new Error("Generation workflow binding is unavailable.");
    }
    const instance = await workflow.create({ params: { jobId: data.id } });
    await getSupabaseClient().from("generation_jobs").update({ workflow_instance_id: instance.id }).eq("id", data.id);
  } catch {
    await getSupabaseClient()
      .from("generation_jobs")
      .update({ status: "failed", stage: "failed", error_code: "GENERATION_FAILED", error_message: "생성 작업을 시작하지 못했습니다." })
      .eq("id", data.id);
  }
  return getJob(userId, data.id);
}

export { getJob };
