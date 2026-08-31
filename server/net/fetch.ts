/**
 * 시간 제한이 있는 fetch.
 *
 * 외부 호출에 제한이 없으면 응답이 오지 않는 동안 생성 작업이 그대로 매달린다.
 * 작업은 사용자당 하나만 활성일 수 있으므로, 매달린 작업 하나가 그 사용자의
 * 다음 시도까지 막는다. 그래서 모든 외부 호출에 상한을 둔다.
 */

export class RequestTimeoutError extends Error {
  constructor(url: string, timeoutMs: number) {
    super(`Request to ${url} timed out after ${timeoutMs}ms.`);
    // step 경계를 넘으면 클래스가 사라지고 name만 남는다. 분류는 name으로 한다.
    this.name = "RequestTimeoutError";
  }
}

export const TIMEOUTS = {
  github: 10_000,
  githubSync: 15_000,
  /** 모델이 긴 문서를 만들어 내므로 넉넉히 준다. */
  openai: 120_000,
  oauth: 10_000,
} as const;

export async function fetchWithTimeout(
  input: string | URL,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  try {
    return await fetch(input, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new RequestTimeoutError(String(input), timeoutMs);
    }
    throw error;
  }
}
