import assert from "node:assert/strict";
import test from "node:test";

/**
 * 되묻기 질문을 거르는 규칙.
 *
 * 질문을 만드는 것은 모델이지만 물어도 되는 질문인지는 코드가 정한다. 여기
 * 걸린 실패는 전부 "사용자가 답을 다 쓴 뒤에야 드러나는" 종류다.
 */

const { selectFollowUpQuestions, MAX_QUESTIONS, MAX_SINGLE_QUESTIONS_PER_PROJECT } = await import(
  new URL("../server/portfolio/questions.ts", import.meta.url)
);

function target(overrides = {}) {
  return {
    repositoryName: "portfolio-api",
    highlights: [],
    hasKeyDecision: false,
    contributorCount: 1,
    ownContributionUnverifiable: false,
    ...overrides,
  };
}

const TOPIC = "재시도 처리를 withRetry로 감싼 커밋";

/** 결정 한 묶음. 셋이 함께 다녀야 하나의 결정이 된다. */
function decisionGroup(repositoryName = "portfolio-api", topic = TOPIC) {
  return [
    { repositoryName, topic, field: "decisionProblem", question: "그 전에는 어떤 문제가 있었나요?" },
    { repositoryName, topic, field: "decisionApproach", question: "다른 방법도 있었을 텐데 이 방법을 고른 이유는요?" },
    { repositoryName, topic, field: "decisionOutcome", question: "그래서 무엇이 달라졌나요?" },
  ];
}

test("결정 세 조각을 묶음으로 남긴다", () => {
  const result = selectFollowUpQuestions(decisionGroup(), [target()]);
  assert.equal(result.length, 3);
  for (const item of result) {
    assert.equal(item.topic, TOPIC, "같은 결정이면 topic이 같아야 해요");
    assert.equal(item.repositoryName, "portfolio-api");
  }
});

test("세 조각이 다 모이지 않은 결정은 통째로 버린다", () => {
  /* 하나만 남으면 사용자가 성심껏 답해도 결정이 완성되지 않는다. 반쪽짜리
     결정은 문서에 넣지 않으므로 아무것도 바뀌지 않고, 그 사실은 답을 다 쓴
     뒤에야 드러난다. */
  const partial = decisionGroup().slice(0, 2);
  assert.deepEqual(selectFollowUpQuestions(partial, [target()]), []);
});

test("무엇에 대한 결정인지 없으면 묻지 않는다", () => {
  // topic이 없으면 지원자는 어느 결정을 말하는지 알 수 없어 답할 수 없다.
  const nameless = decisionGroup().map((item) => ({ ...item, topic: "" }));
  assert.deepEqual(selectFollowUpQuestions(nameless, [target()]), []);
});

test("초안이 이미 결정을 채웠으면 다시 묻지 않는다", () => {
  // 이미 채워진 자리를 물으면 사용자가 답해도 아무것도 바뀌지 않는다.
  assert.deepEqual(
    selectFollowUpQuestions(decisionGroup(), [target({ hasKeyDecision: true })]),
    [],
  );
});

test("근거로 쓰지 않은 저장소는 묻지 않는다", () => {
  // 답을 받아도 붙일 자리가 없다.
  assert.deepEqual(selectFollowUpQuestions(decisionGroup("다른-저장소"), [target()]), []);
});

test("저장소 이름의 대소문자와 공백 차이를 흡수하되 근거의 이름으로 저장한다", () => {
  /* 모델이 되받아 적은 문자열이라 표기가 어긋날 수 있다. 여기서 못 찾으면
     멀쩡한 질문이 통째로 사라진다. 반대로 저장은 정확한 이름이어야 나중에
     프로젝트를 다시 찾을 수 있다. */
  const result = selectFollowUpQuestions(decisionGroup("  Portfolio-API "), [target()]);
  assert.equal(result.length, 3);
  assert.ok(result.every((item) => item.repositoryName === "portfolio-api"));
});

test("역할은 담당 범위가 실제로 불분명할 때만 묻는다", () => {
  /* role은 근거가 없어도 '프로젝트 개발'처럼 중립적인 표현으로 항상 채워진다.
     "비어 있음"으로 판단할 수 없어 규칙이 따로 필요하다. */
  const question = [{
    repositoryName: "portfolio-api",
    field: "role",
    topic: "",
    question: "이 프로젝트에서 어떤 부분을 맡으셨나요?",
  }];

  assert.deepEqual(
    selectFollowUpQuestions(question, [target({ contributorCount: 1 })]),
    [],
    "혼자 만든 저장소에서는 역할을 물을 이유가 없어요",
  );
  assert.equal(selectFollowUpQuestions(question, [target({ contributorCount: 3 })]).length, 1);
  // 본인 커밋을 하나도 확인하지 못했으면 혼자여도 역할이 불분명하다.
  assert.equal(
    selectFollowUpQuestions(question, [target({ ownContributionUnverifiable: true })]).length,
    1,
  );
});

test("낱개 질문의 topic은 비운다", () => {
  const result = selectFollowUpQuestions(
    [{ repositoryName: "portfolio-api", field: "highlights", topic: "아무거나", question: "더 남길 것이 있나요?" }],
    [target()],
  );
  assert.equal(result[0].topic, null, "묶을 상대가 없는 질문에 topic이 붙었어요");
});

test("같은 자리를 두 번 묻지 않는다", () => {
  // DB의 유니크 인덱스와 같은 기준이다. 여기서 거르지 않으면 저장이 실패한다.
  const doubled = [...decisionGroup(), ...decisionGroup()];
  assert.equal(selectFollowUpQuestions(doubled, [target()]).length, 3);
});

test("낱개 질문이 한 프로젝트에 몰리지 않는다", () => {
  const many = ["role", "highlights", "highlights"].map((field, index) => ({
    repositoryName: "portfolio-api",
    field,
    topic: "",
    question: `${index}번 질문을 드려도 될까요?`,
  }));
  const result = selectFollowUpQuestions(many, [target({ contributorCount: 3 })]);
  assert.ok(result.length <= MAX_SINGLE_QUESTIONS_PER_PROJECT);
});

test("상한 때문에 결정이 반쪽으로 잘리지 않는다", () => {
  /* 앞에서 애써 걸러낸 "반쪽짜리 결정"이 상한 때문에 다시 생기면 안 된다.
     묶음은 통째로 들어가거나 통째로 빠진다. */
  const repositories = ["a", "b", "c"];
  const questions = repositories.flatMap((name) => decisionGroup(name, `${name} 결정`));
  const targets = repositories.map((name) => target({ repositoryName: name }));

  const result = selectFollowUpQuestions(questions, targets);
  assert.ok(result.length <= MAX_QUESTIONS, `질문이 ${result.length}개나 돼요`);

  const counts = new Map();
  for (const item of result) {
    counts.set(item.topic, (counts.get(item.topic) ?? 0) + 1);
  }
  for (const [topic, count] of counts) {
    assert.equal(count, 3, `"${topic}" 결정이 ${count}개만 남았어요`);
  }
});

test("답할 수 없는 질문을 걸러낸다", () => {
  const results = selectFollowUpQuestions(
    [
      ...decisionGroup().map((item) => ({ ...item, question: "왜?" })),
      { repositoryName: "portfolio-api", field: "techStack", topic: "", question: "어떤 기술을 쓰셨나요?" },
      { repositoryName: "portfolio-api", field: "highlights", topic: "", question: "가".repeat(200) },
    ],
    [target()],
  );
  assert.deepEqual(results, []);
});
