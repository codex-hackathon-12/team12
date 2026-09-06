import assert from "node:assert/strict";
import test from "node:test";

/**
 * "무엇이 달라졌는지"를 만드는 자리.
 *
 * 서버는 바뀐 자리(`updatedFields`)와 새 문서를 줄 뿐, 바뀌기 전 문장은
 * 돌려주지 않는다. 이전 값을 아는 것은 문서를 들고 있는 화면뿐이라 견주기는
 * 여기서 한다. 여기 걸린 단언은 화면이 사실과 다른 말을 하는 것을 막는다 —
 * 한 문단 바뀐 것을 "3곳 바뀜"이라고 하거나, 멀쩡히 있던 문장을 "비어
 * 있었어요"로 만드는 것.
 */

const { summarizeRewrite, SLOT_LABEL } = await import(
  new URL("../lib/rewrite-summary.ts", import.meta.url)
);

const URL_BY_NAME = new Map([["portfolio-api", "https://github.com/example/portfolio-api"]]);

const EMPTY_DECISION = { headline: "", problem: "", approach: "", outcome: "" };
const DECISION = {
  headline: "생성 흐름을 세 단계로 나눔",
  problem: "저장에서 실패하면 수집과 모델 호출이 통째로 다시 돌았다.",
  approach: "단계 사이 산출물을 별도 테이블에 뒀다.",
  outcome: "저장 재시도에서 모델을 다시 부르지 않는다.",
};

function content(project = {}) {
  return {
    projects: [{
      id: "project-1",
      title: "포트폴리오 생성 API",
      repositoryUrl: "https://github.com/example/portfolio-api",
      role: "프로젝트 개발",
      highlights: ["생성 파이프라인을 단계로 분리"],
      keyDecision: { ...EMPTY_DECISION },
      ...project,
    }],
  };
}

const slots = (...fields) => fields.map((field) => ({ repositoryName: "portfolio-api", field }));

test("결정 세 조각이 한 항목으로 접힌다", () => {
  /* `applyRewrite`는 답한 슬롯마다 `updatedFields`를 밀어넣어 결정 하나에 세
     줄이 온다. 접지 않으면 문단 하나 바뀐 것을 "3곳 바뀜"이라고 말한다. */
  const changes = summarizeRewrite(
    content(),
    content({ keyDecision: DECISION }),
    slots("decisionProblem", "decisionApproach", "decisionOutcome"),
    URL_BY_NAME,
  );
  assert.equal(changes.length, 1, "결정이 세 항목으로 갈라졌어요");
  assert.equal(changes[0].slot, "keyDecision");
  assert.equal(SLOT_LABEL[changes[0].slot], "핵심 결정");
  // 표제와 세 문장이 모두 담긴다. 하나만 보여주면 무엇이 결정인지 안 읽힌다.
  assert.equal(changes[0].after.length, 4);
});

test("비어 있던 자리는 이전을 지어내지 않는다", () => {
  const changes = summarizeRewrite(
    content(),
    content({ keyDecision: DECISION }),
    slots("decisionOutcome"),
    URL_BY_NAME,
  );
  assert.equal(changes[0].mode, "filled");
  assert.deepEqual(changes[0].before, []);
});

test("있던 문장이 바뀌면 이전을 함께 남긴다", () => {
  const changes = summarizeRewrite(
    content({ role: "프로젝트 개발" }),
    content({ role: "백엔드 리드" }),
    slots("role"),
    URL_BY_NAME,
  );
  assert.equal(changes[0].mode, "replaced");
  assert.deepEqual(changes[0].before, ["프로젝트 개발"]);
  assert.deepEqual(changes[0].after, ["백엔드 리드"]);
});

test("강조는 늘어난 항목만 담는다", () => {
  /* 답이 기존 항목 뒤에 붙는 자리다. 통째로 견주면 안 바뀐 문장까지 "지금"에
     섞여 무엇이 새것인지 다시 알 수 없어지고, "이전"이 비어 보여서 멀쩡히
     있던 문장을 없던 것으로 만든다. */
  const changes = summarizeRewrite(
    content(),
    content({ highlights: ["생성 파이프라인을 단계로 분리", "재시도 예산을 저장소마다 나눔"] }),
    slots("highlights"),
    URL_BY_NAME,
  );
  assert.equal(changes[0].mode, "added");
  assert.deepEqual(changes[0].after, ["재시도 예산을 저장소마다 나눔"]);
  assert.deepEqual(changes[0].before, [], "있던 항목을 사라진 것으로 세었어요");
});

test("바뀌지 않은 자리는 항목을 만들지 않는다", () => {
  /* 서버가 슬롯을 세어 돌려줘도 값이 그대로면 화면은 바뀌었다고 말하면 안
     된다. "문서가 바뀌었어요"를 띄우고 아무것도 안 바뀐 것이 가장 나쁘다. */
  const same = content({ role: "프로젝트 개발" });
  assert.deepEqual(summarizeRewrite(same, content({ role: "프로젝트 개발" }), slots("role"), URL_BY_NAME), []);
});

test("근거에 없는 저장소는 건너뛴다", () => {
  const changes = summarizeRewrite(
    content(),
    content({ role: "백엔드 리드" }),
    [{ repositoryName: "unknown-repo", field: "role" }],
    URL_BY_NAME,
  );
  assert.deepEqual(changes, []);
});
