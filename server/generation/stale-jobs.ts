import { logOperationFailure } from "@/server/observability/api-logging";
import { getSupabaseClient } from "@/server/supabase/client";

/**
 * 이 시간 넘게 진척이 없는 작업은 되살아날 가망이 없다고 본다.
 *
 * 사용자당 활성 작업은 부분 유니크 인덱스로 하나만 허용된다. 그래서 작업이
 * queued/processing에 갇히면 그 사용자는 다시는 생성을 시작할 수 없고,
 * 재시도는 failed 상태에서만 되므로 스스로 빠져나올 방법도 없다.
 * 여기서 failed로 바꿔주면 기존 재시도 흐름이 그대로 구조 통로가 된다.
 *
 * 단계가 바뀔 때마다 updated_at이 갱신되므로(generation_jobs_set_updated_at 트리거)
 * 실제로 진행 중인 작업은 이 임계에 걸리지 않는다.
 */
export const STALE_JOB_TIMEOUT_MS = 10 * 60 * 1000;

const STALE_JOB_MESSAGE = "생성이 예상보다 오래 걸려 중단했어요. 다시 시도해주세요.";

export function isStaleJob(
  status: string,
  updatedAt: string,
  now: number = Date.now(),
): boolean {
  if (status !== "queued" && status !== "processing") {
    return false;
  }
  const updated = Date.parse(updatedAt);
  return Number.isFinite(updated) && now - updated > STALE_JOB_TIMEOUT_MS;
}

/**
 * 멈춘 작업을 실패로 돌린다. 조건부 UPDATE 한 번이라 동시에 두 번 불려도
 * 두 번째는 0건을 갱신한다. WHERE 절이 기존 활성 작업 인덱스와 같은 모양이다.
 */
export async function expireStaleJobs(userId: string): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_JOB_TIMEOUT_MS).toISOString();
  const { data, error } = await getSupabaseClient()
    .from("generation_jobs")
    .update({
      status: "failed",
      stage: "failed",
      error_code: "GENERATION_FAILED",
      error_message: STALE_JOB_MESSAGE,
    })
    .eq("user_id", userId)
    .in("status", ["queued", "processing"])
    .lt("updated_at", cutoff)
    .select("id");

  if (error) {
    // 청소가 실패해도 원래 요청까지 막지는 않는다.
    logOperationFailure({ domain: "generations", operation: "job.expire", error });
    return 0;
  }

  // 어떤 실패 모드가 실제로 터지는지 알아야 원인을 좁힐 수 있다.
  for (const job of data ?? []) {
    logOperationFailure({
      domain: "generations",
      operation: "job.expired",
      jobId: job.id,
      error: new Error(STALE_JOB_MESSAGE),
    });
  }

  return data?.length ?? 0;
}
