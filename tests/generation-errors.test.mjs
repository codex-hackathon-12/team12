import assert from "node:assert/strict";
import test from "node:test";

const { classifyGenerationFailure } = await import(
  new URL("../server/generation/errors.ts", import.meta.url)
);

const named = (name) => Object.assign(new Error("실패"), { name });

test("GitHub 레이트리밋은 전용 코드로 구분한다", () => {
  const failure = classifyGenerationFailure(named("GitHubRateLimitedError"));
  assert.equal(failure.code, "GITHUB_RATE_LIMITED");
  assert.equal(failure.retryable, true);
  assert.match(failure.message, /한도/u);
});

test("연동이 끊긴 경우는 재시도해도 소용없다", () => {
  const failure = classifyGenerationFailure(named("GitHubConnectionError"));
  assert.equal(failure.code, "GITHUB_CONNECTION_ERROR");
  assert.equal(failure.retryable, false);
});

test("저장소를 못 찾는 것도 재시도 대상이 아니다", () => {
  assert.equal(classifyGenerationFailure(named("RepositoryLookupError")).retryable, false);
});

test("타임아웃과 모델 오류는 다시 해볼 여지가 있다", () => {
  assert.equal(classifyGenerationFailure(named("RequestTimeoutError")).retryable, true);
  assert.equal(classifyGenerationFailure(named("OpenAIResponseError")).retryable, true);
  assert.equal(classifyGenerationFailure(named("OpenAISchemaError")).retryable, true);
});

test("모르는 실패는 기존 문구를 그대로 쓴다", () => {
  const failure = classifyGenerationFailure(new Error("알 수 없음"));
  assert.equal(failure.code, "GENERATION_FAILED");
  assert.equal(failure.message, "잠시 후 다시 시도해주세요.");
});

test("에러가 아닌 값이 와도 무너지지 않는다", () => {
  assert.equal(classifyGenerationFailure(undefined).code, "GENERATION_FAILED");
  assert.equal(classifyGenerationFailure("문자열").code, "GENERATION_FAILED");
});
