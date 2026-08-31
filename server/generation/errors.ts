/**
 * 생성 실패를 사용자에게 설명 가능한 형태로 분류한다.
 *
 * step에서 던진 에러는 workflow 본문으로 넘어오며 클래스가 사라지고 name만 남는다.
 * 그래서 instanceof가 아니라 name 문자열로 판단한다. RepositoryLookupError가
 * 이미 쓰는 관례이고, 로깅도 name을 읽는다.
 *
 * 외부 의존이 없는 순수 함수라 그대로 테스트할 수 있다.
 */

export type GenerationFailure = {
  code: "GENERATION_FAILED" | "GITHUB_RATE_LIMITED" | "GITHUB_CONNECTION_ERROR";
  message: string;
  /** 같은 조건에서 다시 해도 결과가 같다면 재시도가 의미 없다. */
  retryable: boolean;
};

const FAILURES: Record<string, GenerationFailure> = {
  GitHubRateLimitedError: {
    code: "GITHUB_RATE_LIMITED",
    message: "GitHub 호출 한도에 걸렸어요. 잠시 뒤에 다시 시도해주세요.",
    retryable: true,
  },
  GitHubConnectionError: {
    code: "GITHUB_CONNECTION_ERROR",
    message: "GitHub에서 저장소 정보를 가져오지 못했어요. 설정에서 연동을 확인해주세요.",
    retryable: false,
  },
  RepositoryLookupError: {
    code: "GITHUB_CONNECTION_ERROR",
    message: "저장소를 찾지 못했어요. 저장소를 다시 동기화한 뒤 시도해주세요.",
    retryable: false,
  },
  RequestTimeoutError: {
    code: "GENERATION_FAILED",
    message: "외부 응답이 너무 늦어 중단했어요. 잠시 뒤에 다시 시도해주세요.",
    retryable: true,
  },
  OpenAIResponseError: {
    code: "GENERATION_FAILED",
    message: "콘텐츠 생성에 실패했어요. 잠시 뒤에 다시 시도해주세요.",
    retryable: true,
  },
  OpenAISchemaError: {
    code: "GENERATION_FAILED",
    message: "생성 결과가 형식에 맞지 않았어요. 다시 시도하면 대개 해결됩니다.",
    retryable: true,
  },
};

const DEFAULT_FAILURE: GenerationFailure = {
  code: "GENERATION_FAILED",
  message: "잠시 후 다시 시도해주세요.",
  retryable: true,
};

export function classifyGenerationFailure(error: unknown): GenerationFailure {
  const name = error instanceof Error ? error.name : "";
  return FAILURES[name] ?? DEFAULT_FAILURE;
}
