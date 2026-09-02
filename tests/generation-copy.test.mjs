import assert from "node:assert/strict";
import test from "node:test";

const {
  GENERATION_STEPS,
  documentSummary,
  elapsedLabel,
  progressPercent,
  stageIndex,
  stageMessage,
  stageValueText,
} = await import(new URL("../lib/copy.ts", import.meta.url));

const STAGES = [
  "queued",
  "analyzingRepository",
  "generatingContent",
  "renderingPortfolio",
  "completed",
  "failed",
];

const job = (overrides) => ({
  stage: "analyzingRepository",
  status: "processing",
  repositoryIds: ["repo_1"],
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
  ...overrides,
});

test("모든 단계가 문구를 갖는다", () => {
  // 하나라도 비면 진행 화면의 가장 큰 글자가 사라진다.
  for (const stage of STAGES) {
    const message = stageMessage(job({ stage }));
    assert.ok(message && message.length > 0, `${stage} 문구가 비어 있어요`);
  }
});

test("모든 문구가 해요체다", () => {
  for (const stage of STAGES) {
    assert.ok(!stageMessage(job({ stage })).includes("습니다"), `${stage}가 습니다체예요`);
  }
});

test("저장소가 여러 개면 개수를 말한다", () => {
  assert.match(stageMessage(job({ repositoryIds: ["a", "b", "c"] })), /3개/u);
  assert.ok(!stageMessage(job({ repositoryIds: ["a"] })).includes("1개"));
});

test("단계 번호가 범위를 벗어나지 않는다", () => {
  for (const stage of STAGES) {
    const index = stageIndex(stage);
    assert.ok(index >= 0 && index <= GENERATION_STEPS.length, `${stage}: ${index}`);
  }
  // 실패는 어느 단계도 진행 중이 아니므로 첫 단계로 떨어뜨린다.
  assert.equal(stageIndex("failed"), 0);
  assert.equal(stageIndex("completed"), GENERATION_STEPS.length);
});

test("진행률이 시간과 함께 움직인다", () => {
  // 예전에는 단계 경계에서만 갱신돼 가장 긴 구간에서 얼어 있었다.
  const start = Date.parse("2026-09-01T00:00:00.000Z");
  const current = job({ stage: "generatingContent", updatedAt: "2026-09-01T00:00:00.000Z" });
  const at0 = progressPercent(current, start);
  const at20 = progressPercent(current, start + 20_000);
  const at50 = progressPercent(current, start + 50_000);
  assert.ok(at20 > at0, `20초 뒤에도 그대로예요 (${at0} → ${at20})`);
  assert.ok(at50 > at20, `50초 뒤에도 그대로예요 (${at20} → ${at50})`);
});

test("진행률이 뒤로 가거나 다음 단계를 앞지르지 않는다", () => {
  const start = Date.parse("2026-09-01T00:00:00.000Z");
  const analyzing = progressPercent(job({ stage: "analyzingRepository" }), start + 999_000);
  const generating = progressPercent(job({ stage: "generatingContent" }), start);
  assert.ok(analyzing < generating, `${analyzing} < ${generating} 이어야 해요`);
  assert.ok(analyzing <= 99, "끝나기 전에 100%가 되면 안 돼요");
});

test("완료는 100, 그 외에는 100이 되지 않는다", () => {
  assert.equal(progressPercent(job({ stage: "completed" })), 100);
  const late = progressPercent(job({ stage: "renderingPortfolio" }), Date.parse("2027-01-01T00:00:00.000Z"));
  assert.ok(late < 100, `아직 안 끝났는데 ${late}%예요`);
});

test("화면 낭독기가 읽을 문구에 위치가 담긴다", () => {
  assert.match(stageValueText(job({ stage: "generatingContent" })), /4단계 중 3단계/u);
  assert.match(stageValueText(job({ stage: "completed" })), /완료/u);
});

test("경과 시간을 사람이 읽는 단위로 말한다", () => {
  const start = Date.parse("2026-09-01T00:00:00.000Z");
  assert.equal(elapsedLabel("2026-09-01T00:00:00.000Z", start + 42_000), "42초 지났어요");
  assert.equal(elapsedLabel("2026-09-01T00:00:00.000Z", start + 120_000), "2분 지났어요");
  assert.equal(elapsedLabel("2026-09-01T00:00:00.000Z", start + 95_000), "1분 35초 지났어요");
});

test("읽을 수 없는 시각에도 무너지지 않는다", () => {
  assert.equal(elapsedLabel("알 수 없음"), "");
  assert.ok(Number.isFinite(progressPercent(job({ updatedAt: "알 수 없음" }))));
});

test("인쇄 안내는 장수를 알 때만 장수를 말한다", () => {
  const content = { projects: [{}, {}, {}], skills: [{}] };
  assert.equal(documentSummary(content, 4), "A4 4장 · 프로필, 프로젝트 3건, 역량 포함");
  // 읽기 보기에서는 나눠보지 않았으므로 장수를 지어내지 않는다.
  assert.equal(
    documentSummary(content, null),
    "인쇄하면 A4 세로로 나와요 · 프로필, 프로젝트 3건, 역량 포함",
  );
});

test("인쇄 안내는 없는 항목을 포함이라고 말하지 않는다", () => {
  // 근거가 없으면 빈 배열이 오고, 그 섹션은 렌더링되지 않는다.
  assert.equal(documentSummary({ projects: [], skills: [] }, 1), "A4 1장 · 프로필 포함");
});
