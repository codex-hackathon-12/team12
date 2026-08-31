import assert from "node:assert/strict";
import test from "node:test";

const { isTokenExpiring } = await import(
  new URL("../server/auth/github-token.ts", import.meta.url)
);

const now = Date.parse("2026-08-31T12:00:00.000Z");
const minutesFromNow = (minutes) => new Date(now + minutes * 60_000).toISOString();

test("여유 시간을 두고 미리 갱신 대상으로 본다", () => {
  // 호출 도중에 만료돼 실패하는 것보다 조금 일찍 갱신하는 쪽이 낫다.
  assert.equal(isTokenExpiring(minutesFromNow(2), now), true);
  assert.equal(isTokenExpiring(minutesFromNow(-60), now), true);
});

test("아직 넉넉히 남았으면 그대로 쓴다", () => {
  assert.equal(isTokenExpiring(minutesFromNow(60), now), false);
});

test("만료 정보가 없는 연동은 만료되지 않는 토큰으로 본다", () => {
  assert.equal(isTokenExpiring(null, now), false);
});

test("읽을 수 없는 값에 속아 갱신하지 않는다", () => {
  assert.equal(isTokenExpiring("언젠가", now), false);
});
