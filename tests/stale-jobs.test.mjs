import assert from "node:assert/strict";
import test from "node:test";

const { STALE_JOB_TIMEOUT_MS, isStaleJob } = await import(
  new URL("../server/generation/stale-jobs.ts", import.meta.url)
);

const now = Date.parse("2026-08-31T12:00:00.000Z");
const minutesAgo = (minutes) => new Date(now - minutes * 60_000).toISOString();

test("진행 중이라도 임계 시간을 넘기면 멈춘 작업으로 본다", () => {
  assert.equal(isStaleJob("processing", minutesAgo(30), now), true);
  assert.equal(isStaleJob("queued", minutesAgo(30), now), true);
});

test("아직 진척이 있는 작업은 건드리지 않는다", () => {
  assert.equal(isStaleJob("processing", minutesAgo(1), now), false);
  assert.equal(isStaleJob("queued", minutesAgo(9), now), false);
});

test("이미 끝난 작업은 상태와 무관하게 대상이 아니다", () => {
  assert.equal(isStaleJob("completed", minutesAgo(300), now), false);
  assert.equal(isStaleJob("failed", minutesAgo(300), now), false);
});

test("임계값 경계에서 아직 만료시키지 않는다", () => {
  const boundary = new Date(now - STALE_JOB_TIMEOUT_MS).toISOString();
  assert.equal(isStaleJob("processing", boundary, now), false);
});

test("갱신 시각을 읽을 수 없으면 만료시키지 않는다", () => {
  assert.equal(isStaleJob("processing", "정보 없음", now), false);
});
