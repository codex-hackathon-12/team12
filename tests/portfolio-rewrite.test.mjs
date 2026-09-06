import assert from "node:assert/strict";
import test from "node:test";

/**
 * "답한 부분만 바뀐다"는 약속을 지키는 자리.
 *
 * 프롬프트에 "다른 곳은 건드리지 마세요"라고 적는 것은 지시일 뿐 강제가 아니다.
 * 모델은 요청하지 않은 자리도 곧잘 돌려준다. 그래서 여기 걸린 단언들이 곧
 * 사용자에게 한 약속이다 — 이게 깨지면 되묻기를 할 이유 자체가 사라진다.
 */

const { applyRewrite } = await import(new URL("../server/portfolio/rewrite.ts", import.meta.url));

const URL_BY_NAME = new Map([
  ["portfolio-api", "https://github.com/example/portfolio-api"],
  ["signal-board", "https://github.com/example/signal-board"],
]);

const EMPTY_DECISION = { headline: "", problem: "", approach: "", outcome: "" };

const FILLED_DECISION = {
  headline: "생성 흐름을 세 단계로 나눔",
  problem: "저장에서 실패하면 GitHub 수집과 모델 호출이 통째로 다시 돌았다.",
  approach: "단계 사이 산출물을 별도 테이블에 두고 이미 있으면 건너뛰게 했다.",
  outcome: "저장 재시도에서 모델을 다시 부르지 않는다.",
};

/** 결정 세 조각을 한 번에 반영하는 요청. 실제 흐름과 같은 모양이다. */
const DECISION_SLOTS = ["decisionProblem", "decisionApproach", "decisionOutcome"]
  .map((field) => ({ repositoryName: "portfolio-api", field }));

function content() {
  return {
    profile: {
      displayName: "김지원",
      headline: "문제를 제품으로 번역하는 개발자",
      targetRole: "Backend Engineer",
      avatarUrl: null,
    },
    introduction: "비동기 파이프라인을 다룬 경험이 있습니다.",
    skills: [{ category: "언어", skills: ["TypeScript"] }],
    projects: [
      {
        id: "project-1",
        title: "포트폴리오 생성 API",
        description: "GitHub 근거로 포트폴리오를 만드는 서비스",
        repositoryUrl: "https://github.com/example/portfolio-api",
        role: "프로젝트 개발",
        techStack: ["TypeScript", "Next.js"],
        context: { period: "2026.03–06", scale: "개인" },
        keyDecision: { ...EMPTY_DECISION },
        highlights: ["생성 파이프라인을 단계로 분리"],
        challenges: [],
        solutions: [],
        impact: [],
      },
      {
        id: "project-2",
        title: "신호 보드",
        description: "지표를 모아 보는 대시보드",
        repositoryUrl: "https://github.com/example/signal-board",
        role: "프로젝트 개발",
        techStack: ["React"],
        context: { period: null, scale: "3명" },
        keyDecision: { ...EMPTY_DECISION },
        highlights: [],
        challenges: [],
        solutions: [],
        impact: [],
      },
    ],
    gitAnalysis: {
      summary: "요약",
      primaryLanguage: "TypeScript",
      languages: [{ name: "TypeScript", percentage: 90 }],
      starCount: 1,
      forkCount: 0,
      notablePatterns: ["기능 단위로 PR을 나눔"],
      lastActivityAt: null,
    },
    contact: { githubUrl: "https://github.com/example", email: null, location: null },
  };
}

const rewrite = (overrides = {}) => ({
  repositoryName: "portfolio-api",
  role: "프로젝트 개발",
  highlights: [],
  keyDecision: { ...EMPTY_DECISION },
  ...overrides,
});

test("답한 자리만 바뀌고 나머지는 참조까지 그대로다", () => {
  const before = content();
  const { content: after, updatedFields } = applyRewrite(
    before,
    [rewrite({ keyDecision: FILLED_DECISION })],
    DECISION_SLOTS,
    URL_BY_NAME,
  );

  assert.deepEqual(after.projects[0].keyDecision, FILLED_DECISION);
  assert.equal(updatedFields.length, 3, "세 조각 모두 답한 자리로 세어야 해요");

  // 손대지 않은 항목은 값이 같은 정도가 아니라 같은 객체여야 한다.
  assert.equal(after.profile, before.profile);
  assert.equal(after.skills, before.skills);
  assert.equal(after.gitAnalysis, before.gitAnalysis);
  assert.equal(after.contact, before.contact);
  assert.equal(after.introduction, before.introduction);
  assert.equal(after.projects[1], before.projects[1]);
  assert.equal(after.projects[0].highlights, before.projects[0].highlights);
  assert.equal(after.projects[0].context, before.projects[0].context);
});

test("요청하지 않은 자리는 모델이 돌려줘도 버린다", () => {
  /* 이것이 이 함수의 존재 이유다. 응답을 순회하지 않고 답이 있는 자리만
     순회하므로, 모델이 무엇을 더 얹든 들어올 통로가 없다. */
  const before = content();
  const { content: after, updatedFields } = applyRewrite(
    before,
    [rewrite({
      role: "백엔드 리드",
      highlights: ["새 하이라이트"],
      keyDecision: FILLED_DECISION,
    })],
    DECISION_SLOTS,
    URL_BY_NAME,
  );

  assert.deepEqual(after.projects[0].keyDecision, FILLED_DECISION);
  assert.equal(after.projects[0].role, "프로젝트 개발", "요청하지 않은 role이 바뀌었어요");
  assert.deepEqual(after.projects[0].highlights, ["생성 파이프라인을 단계로 분리"]);
  assert.ok(updatedFields.every((slot) => slot.field.startsWith("decision")));
});

test("반쪽짜리 결정은 문서에 넣지 않는다", () => {
  /* 문제만 있고 선택이 없는 문단은 면접관에게 아무것도 말해주지 않는다.
     사용자에게는 "답했는데 왜 저렇게 나왔지"로 보인다. */
  const before = content();
  const half = { ...FILLED_DECISION, approach: "" };
  const { content: after, updatedFields } = applyRewrite(
    before,
    [rewrite({ keyDecision: half })],
    DECISION_SLOTS,
    URL_BY_NAME,
  );
  assert.deepEqual(updatedFields, []);
  assert.equal(after, before);
});

test("답하지 않은 프로젝트는 건드리지 않는다", () => {
  const before = content();
  const { content: after } = applyRewrite(
    before,
    [rewrite({ repositoryName: "signal-board", keyDecision: FILLED_DECISION })],
    DECISION_SLOTS,
    URL_BY_NAME,
  );
  assert.equal(after, before, "요청한 자리에 재작성이 없으면 원본이 그대로 나와야 해요");
});

test("빈 값이 기존 문장을 지우지 않는다", () => {
  /* 모델이 빈 값을 돌려주는 것은 "근거가 없어 못 썼다"는 뜻이다. 그걸 그대로
     반영하면 답변 한 번에 멀쩡하던 항목이 사라진다. */
  const before = content();
  before.projects[0].highlights = ["재시도가 중복 호출을 일으켰다"];

  const { content: after, updatedFields } = applyRewrite(
    before,
    [rewrite({ highlights: [] })],
    [{ repositoryName: "portfolio-api", field: "highlights" }],
    URL_BY_NAME,
  );
  assert.deepEqual(updatedFields, []);
  assert.equal(after, before);
});

test("같은 값을 다시 쓴 것은 바뀐 것으로 세지 않는다", () => {
  // 화면이 "여기가 바뀌었어요"라고 짚었는데 아무 차이가 없으면 신뢰를 잃는다.
  const before = content();
  const { updatedFields } = applyRewrite(
    before,
    [rewrite({ highlights: ["생성 파이프라인을 단계로 분리"] })],
    [{ repositoryName: "portfolio-api", field: "highlights" }],
    URL_BY_NAME,
  );
  assert.deepEqual(updatedFields, []);
});

test("분량 상한을 넘긴 재작성을 잘라 담는다", () => {
  /* 되묻기는 생성 파이프라인 밖이라 runner의 자르기를 타지 않는다. 여기서
     자르지 않으면 답변 한 번으로 문서 레이아웃이 무너진다. */
  const long = "가".repeat(400);
  const { content: after } = applyRewrite(
    content(),
    [rewrite({ keyDecision: { headline: long, problem: long, approach: long, outcome: long } })],
    DECISION_SLOTS,
    URL_BY_NAME,
  );

  const decision = after.projects[0].keyDecision;
  assert.ok([...decision.headline].length <= 60, "headline이 60자를 넘었어요");
  assert.ok([...decision.problem].length <= 160, "problem이 160자를 넘었어요");
  assert.ok([...decision.approach].length <= 220, "approach가 220자를 넘었어요");
  assert.ok([...decision.outcome].length <= 100, "outcome이 100자를 넘었어요");
});

test("근거에 없는 저장소 이름은 무시한다", () => {
  const before = content();
  const { content: after, updatedFields } = applyRewrite(
    before,
    [rewrite({ repositoryName: "없는-저장소", keyDecision: FILLED_DECISION })],
    [{ repositoryName: "없는-저장소", field: "decisionProblem" }],
    URL_BY_NAME,
  );
  assert.deepEqual(updatedFields, []);
  assert.equal(after, before);
});

/**
 * 안 바뀐 이유.
 *
 * 서버는 왜 버렸는지 알고 있었지만 화면에 넘기지 않았다. 그래서 안내가
 * "조금 더 구체적으로 적어주시면"이라는 추측으로 남았고, 사용자는 원인을
 * 모른 채 같은 답을 고쳐 쓰게 됐다.
 */

test("빈 값과 같은 값은 이유가 다르다", () => {
  const base = content();
  const empty = applyRewrite(base, [rewrite({ role: "" })], [{ repositoryName: "portfolio-api", field: "role" }], URL_BY_NAME);
  assert.deepEqual(empty.skippedFields, [
    { repositoryName: "portfolio-api", field: "role", reason: "empty" },
  ]);

  const same = applyRewrite(
    base,
    [rewrite({ role: base.projects[0].role })],
    [{ repositoryName: "portfolio-api", field: "role" }],
    URL_BY_NAME,
  );
  assert.deepEqual(same.skippedFields, [
    { repositoryName: "portfolio-api", field: "role", reason: "same" },
  ]);
});

test("반쪽짜리 결정은 incomplete로 남는다", () => {
  /* 네 값 중 하나가 비면 결정을 통째로 버린다. 답한 사람에게는 "셋이 다
     있어야 한다"가 아니라 "아무 일도 안 일어났다"로 보인다. */
  const result = applyRewrite(
    content(),
    [rewrite({ keyDecision: { ...FILLED_DECISION, outcome: "" } })],
    DECISION_SLOTS,
    URL_BY_NAME,
  );
  assert.deepEqual(result.updatedFields, []);
  assert.deepEqual(
    result.skippedFields.map((item) => item.reason),
    ["incomplete", "incomplete", "incomplete"],
  );
});

test("모델이 안 돌려준 저장소는 unavailable이다", () => {
  const result = applyRewrite(
    content(),
    [],
    [{ repositoryName: "portfolio-api", field: "role" }],
    URL_BY_NAME,
  );
  assert.deepEqual(result.skippedFields, [
    { repositoryName: "portfolio-api", field: "role", reason: "unavailable" },
  ]);
});

test("바뀐 자리는 이유 목록에 들어가지 않는다", () => {
  /* 둘이 겹치면 화면이 "바뀌었어요"와 "안 바뀌었어요"를 같은 자리에 대해
     동시에 말하게 된다. */
  const result = applyRewrite(
    content(),
    [rewrite({ role: "백엔드 리드" })],
    [{ repositoryName: "portfolio-api", field: "role" }],
    URL_BY_NAME,
  );
  assert.deepEqual(result.updatedFields, [{ repositoryName: "portfolio-api", field: "role" }]);
  assert.deepEqual(result.skippedFields, []);
});
