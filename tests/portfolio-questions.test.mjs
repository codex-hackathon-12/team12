import assert from "node:assert/strict";
import test from "node:test";

/**
 * 되묻기 질문을 거르는 규칙.
 *
 * 질문을 만드는 것은 모델이지만 물어도 되는 질문인지는 코드가 정한다. 여기
 * 걸린 실패는 전부 "사용자가 답을 다 쓴 뒤에야 드러나는" 종류다.
 */

const { selectFollowUpQuestions, MAX_QUESTIONS, MAX_QUESTIONS_PER_PROJECT } = await import(
  new URL("../server/portfolio/questions.ts", import.meta.url)
);

function target(overrides = {}) {
  return {
    repositoryName: "portfolio-api",
    highlights: [],
    challenges: [],
    solutions: [],
    impact: [],
    contributorCount: 1,
    ownContributionUnverifiable: false,
    ownCommitDiffs: [],
    contributionPeriod: null,
    ...overrides,
  };
}

const question = (overrides = {}) => ({
  repositoryName: "portfolio-api",
  field: "impact",
  question: "생성 작업을 단계로 나눈 뒤 무엇이 달라졌나요?",
  ...overrides,
});

test("비어 있는 자리만 묻는다", () => {
  /* 이미 채워진 자리를 물으면 사용자가 성심껏 답해도 아무것도 바뀌지 않는다.
     그 실패는 답을 다 쓴 뒤에야 드러난다. */
  const filled = selectFollowUpQuestions(
    [question()],
    [target({ impact: ["배포 절차가 자동화됐다"] })],
  );
  assert.deepEqual(filled, []);

  const empty = selectFollowUpQuestions([question()], [target()]);
  assert.equal(empty.length, 1);
  assert.equal(empty[0].field, "impact");
});

test("근거로 쓰지 않은 저장소는 묻지 않는다", () => {
  // 답을 받아도 붙일 자리가 없다.
  const result = selectFollowUpQuestions(
    [question({ repositoryName: "다른-저장소" })],
    [target()],
  );
  assert.deepEqual(result, []);
});

test("저장소 이름의 대소문자와 공백 차이를 흡수하되 근거의 이름으로 저장한다", () => {
  /* 모델이 되받아 적은 문자열이라 표기가 어긋날 수 있다. 여기서 못 찾으면
     멀쩡한 질문이 통째로 사라진다. 반대로 저장은 정확한 이름이어야 나중에
     프로젝트를 다시 찾을 수 있다. */
  const result = selectFollowUpQuestions(
    [question({ repositoryName: "  Portfolio-API " })],
    [target()],
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].repositoryName, "portfolio-api");
});

test("역할은 담당 범위가 실제로 불분명할 때만 묻는다", () => {
  /* role은 근거가 없어도 '프로젝트 개발'처럼 중립적인 표현으로 항상 채워진다.
     "비어 있음"으로 판단할 수 없어 규칙이 따로 필요하다. */
  const solo = selectFollowUpQuestions(
    [question({ field: "role", question: "이 프로젝트에서 어떤 부분을 맡으셨나요?" })],
    [target({ contributorCount: 1 })],
  );
  assert.deepEqual(solo, [], "혼자 만든 저장소에서는 역할을 물을 이유가 없어요");

  const team = selectFollowUpQuestions(
    [question({ field: "role", question: "이 프로젝트에서 어떤 부분을 맡으셨나요?" })],
    [target({ contributorCount: 3 })],
  );
  assert.equal(team.length, 1);

  // 본인 커밋을 하나도 확인하지 못했으면 혼자여도 역할이 불분명하다.
  const unverifiable = selectFollowUpQuestions(
    [question({ field: "role", question: "이 프로젝트에서 어떤 부분을 맡으셨나요?" })],
    [target({ contributorCount: 1, ownContributionUnverifiable: true })],
  );
  assert.equal(unverifiable.length, 1);
});

test("같은 자리를 두 번 묻지 않는다", () => {
  // DB의 유니크 인덱스와 같은 기준이다. 여기서 거르지 않으면 저장이 실패한다.
  const result = selectFollowUpQuestions(
    [question(), question({ question: "그 변경으로 무엇이 달라졌나요?" })],
    [target()],
  );
  assert.equal(result.length, 1);
});

test("질문이 너무 많으면 사람은 아무것도 답하지 않는다", () => {
  const repositories = ["a", "b", "c", "d"];
  const questions = repositories.flatMap((name) =>
    ["impact", "challenges", "solutions"].map((field) =>
      question({ repositoryName: name, field, question: `${name}의 ${field}를 알려주실 수 있나요?` }),
    ));
  const targets = repositories.map((name) => target({ repositoryName: name }));

  const result = selectFollowUpQuestions(questions, targets);
  assert.equal(result.length, MAX_QUESTIONS);

  // 한 프로젝트에 몰리지 않는다. 저장소가 여러 개면 고르게 나눈다.
  for (const name of repositories) {
    const count = result.filter((item) => item.repositoryName === name).length;
    assert.ok(count <= MAX_QUESTIONS_PER_PROJECT, `${name}에 질문이 ${count}개 몰렸어요`);
  }
});

test("답할 수 없는 질문을 걸러낸다", () => {
  const results = selectFollowUpQuestions(
    [
      question({ question: "왜?" }),
      question({ field: "techStack", question: "어떤 기술을 쓰셨나요?" }),
      question({ question: "가".repeat(200) }),
    ],
    [target()],
  );
  assert.deepEqual(results, []);
});
