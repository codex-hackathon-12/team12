import assert from "node:assert/strict";
import test from "node:test";

const { TEXT_LIMITS, clampText, clampTextArray } = await import(
  new URL("../server/portfolio/content-limits.ts", import.meta.url)
);

test("상한 안쪽 문장은 손대지 않는다", () => {
  const value = "계약 중심으로 팀의 병렬 개발을 설계했습니다.";
  assert.equal(clampText(value, TEXT_LIMITS.headline), value);
});

test("상한을 넘으면 말줄임으로 마감한다", () => {
  const clamped = clampText("가".repeat(300), TEXT_LIMITS.introduction);
  assert.equal([...clamped].length, TEXT_LIMITS.introduction);
  assert.ok(clamped.endsWith("…"));
});

test("서로게이트 페어를 반 토막 내지 않는다", () => {
  // 그냥 slice하면 이모지가 쪼개져 깨진 글자가 남는다.
  const clamped = clampText("🙂".repeat(20), 5);
  assert.ok(!clamped.includes("�"));
  assert.equal([...clamped].length, 5);
});

test("배열도 항목마다 같은 규칙으로 자른다", () => {
  const clamped = clampTextArray(["짧음", "나".repeat(200)], TEXT_LIMITS.story);
  assert.equal(clamped[0], "짧음");
  assert.equal([...clamped[1]].length, TEXT_LIMITS.story);
});
