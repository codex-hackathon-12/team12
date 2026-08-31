import { classifyGenerationFailure, type GenerationFailure } from "@/server/generation/errors";
import {
  collectGenerationEvidence,
  generateGenerationDraft,
  markGenerationJobFailed,
  persistGenerationPortfolio,
} from "@/server/generation/runner";
import { logOperationFailure } from "@/server/observability/api-logging";

/**
 * 생성은 세 단계로 나뉜다. 예전에는 전부 한 step이었고, 플랫폼이 step을 자동으로
 * 재시도하기 때문에 저장에서 실패하면 GitHub 수집과 모델 호출까지 통째로 다시
 * 돌았다. 단계를 나누고 각 단계가 이미 끝난 일을 건너뛰게 해서, 재시도가
 * 실패한 지점만 다시 하도록 만든다.
 *
 * 단계마다 진행 상태를 갱신하므로 updated_at이 자연스러운 진척 신호가 되고,
 * 멈춘 작업 판정도 그만큼 정확해진다.
 */
export async function generatePortfolioWorkflow(jobId: string): Promise<void> {
  "use workflow";

  try {
    await collectEvidenceStep(jobId);
    await generateDraftStep(jobId);
    await persistPortfolioStep(jobId);
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

async function collectEvidenceStep(jobId: string): Promise<void> {
  "use step";

  await runOrFail(jobId, collectGenerationEvidence);
}

async function generateDraftStep(jobId: string): Promise<void> {
  "use step";

  await runOrFail(jobId, generateGenerationDraft);
}

async function persistPortfolioStep(jobId: string): Promise<void> {
  "use step";

  await runOrFail(jobId, persistGenerationPortfolio);
}

/* 다시 해도 결과가 같은 실패는 재시도를 소진시키지 않는다. 시간과 비용만 쓰고
   사유도 흐려지기 때문이다. 그 자리에서 사유를 남기고 끝낸다. */
async function runOrFail(jobId: string, run: (jobId: string) => Promise<void>): Promise<void> {
  try {
    await run(jobId);
  } catch (error) {
    const failure = classifyGenerationFailure(error);
    if (!failure.retryable) {
      /* 실패로 표시해두면 뒤따르는 단계는 종료 상태를 보고 스스로 물러난다. */
      await markGenerationJobFailed(jobId, failure);
      return;
    }
    throw error;
  }
}

// 네트워크 문제는 한 번 더 해볼 만하다.
collectEvidenceStep.maxRetries = 2;
// 모델 호출은 재시도가 곧 비용이다. 초안이 남아 있으면 어차피 건너뛴다.
generateDraftStep.maxRetries = 1;
// 저장은 멱등하고 값싸다.
persistPortfolioStep.maxRetries = 3;

async function markGenerationFailedStep(
  jobId: string,
  code: GenerationFailure["code"],
  message: string,
): Promise<void> {
  "use step";

  await markGenerationJobFailed(jobId, { code, message });
}
