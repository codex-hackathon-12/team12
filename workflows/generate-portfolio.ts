import { classifyGenerationFailure, type GenerationFailure } from "@/server/generation/errors";
import { markGenerationJobFailed, runGenerationJob } from "@/server/generation/runner";
import { logOperationFailure } from "@/server/observability/api-logging";

export async function generatePortfolioWorkflow(jobId: string): Promise<void> {
  "use workflow";

  try {
    await runGenerationStep(jobId);
  } catch (error) {
    logOperationFailure({
      domain: "generations",
      operation: "workflow.run",
      jobId,
      error,
    });
    /* step 경계를 넘으면 클래스가 사라지므로 name으로 분류한다. 넘기는 값도
       문자열이라 직렬화에 안전하다. */
    const failure = classifyGenerationFailure(error);
    await markGenerationFailedStep(jobId, failure.code, failure.message);
  }
}

/* 이 step 하나가 GitHub 수집·OpenAI 호출·저장을 전부 한다. 기본 재시도는 3회라
   같은 작업이 최대 네 번 돌 수 있고, 그만큼 OpenAI 호출도 반복된다. 순간 장애는
   한 번 더 살리되 반복 과금은 막는 선에서 1회로 둔다. */
async function runGenerationStep(jobId: string): Promise<void> {
  "use step";

  try {
    await runGenerationJob(jobId);
  } catch (error) {
    const failure = classifyGenerationFailure(error);
    if (!failure.retryable) {
      /* 다시 해도 결과가 같은 실패다. 여기서 사유를 남기고 끝낸다. 밖으로 던져
         재시도를 소진시키면 시간과 비용만 쓰고, 사유도 흐려진다. */
      await markGenerationJobFailed(jobId, failure);
      return;
    }
    throw error;
  }
}

runGenerationStep.maxRetries = 1;

async function markGenerationFailedStep(
  jobId: string,
  code: GenerationFailure["code"],
  message: string,
): Promise<void> {
  "use step";

  await markGenerationJobFailed(jobId, { code, message });
}
