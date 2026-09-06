import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * 지원자가 직접 여는 빈 자리.
 *
 * 되묻기 질문은 포트폴리오를 만들 때 초안과 함께 한 번 생긴다. 모델이 어떤
 * 저장소에 대해 결정 묶음을 내지 않으면 그 프로젝트의 핵심 결정은 영영 빈
 * 채로 남았다. 여기 걸린 것은 그 통로가 열려 있는지, 그리고 열면서 앞에서
 * 막아둔 실패를 되살리지 않는지를 지킨다.
 */

const { isOpenSlot } = await import(
  new URL("../server/portfolio/request-questions.ts", import.meta.url)
);
const { buildRequestedQuestions } = await import(
  new URL("../server/portfolio/questions.ts", import.meta.url)
);

const root = new URL("..", import.meta.url).pathname;
const read = (path) => readFileSync(root + path, "utf8");

const project = (overrides = {}) => ({
  keyDecision: { headline: "", problem: "", approach: "", outcome: "" },
  highlights: [],
  ...overrides,
});

test("채워진 자리는 열지 않는다", () => {
  /* 채워진 자리를 물으면 지원자가 성심껏 답해도 병합 단계가 버려 아무것도
     바뀌지 않는다. 답을 다 쓴 뒤에야 드러나는 실패라 여기서 막는다. */
  assert.equal(isOpenSlot("keyDecision", project()), true);
  assert.equal(
    isOpenSlot("keyDecision", project({ keyDecision: { headline: "생성 흐름을 세 단계로 나눔", problem: "", approach: "", outcome: "" } })),
    false,
    "이미 결정이 있는데 또 물어요",
  );
});

test("공백만 있는 표제는 비어 있는 것으로 본다", () => {
  assert.equal(isOpenSlot("keyDecision", project({ keyDecision: { headline: "   ", problem: "", approach: "", outcome: "" } })), true);
});

test("강조는 자리가 남았을 때만 연다", () => {
  /* 상한을 넘겨 물으면 답이 병합에서 잘리고, 지원자는 자기 답이 왜 반쯤만
     들어갔는지 알 수 없다. */
  assert.equal(isOpenSlot("highlights", project({ highlights: ["하나", "둘", "셋"] })), true);
  assert.equal(isOpenSlot("highlights", project({ highlights: ["하나", "둘", "셋", "넷"] })), false);
});

test("라우트가 모르는 자리를 받지 않는다", () => {
  /* 자리 이름을 그대로 믿고 질문을 만들면 병합이 다루지 못하는 field가 DB에
     들어가, 지원자가 답해도 아무것도 안 바뀌는 질문이 영구히 남는다. */
  const route = read("app/api/v1/portfolios/[portfolioId]/questions/route.ts");
  assert.match(route, /const SLOTS: PortfolioQuestionSlot\[\] = \["keyDecision", "highlights"\]/u);
  assert.match(route, /SLOTS\.find/u, "자리 이름을 검사하지 않아요");
  assert.match(route, /VALIDATION_ERROR/u);
  // 이미 채워진 자리는 400이 아니라 그 사실을 말하는 코드로 돌려준다.
  assert.match(route, /SLOT_ALREADY_FILLED/u);
});

test("자리를 여는 데 모델도 근거도 쓰지 않는다", () => {
  /* 크레딧을 쓰지 않고 즉시 열리는 것이 이 설계의 요점이다. 생성 근거가
     남아 있지 않은 오래된 포트폴리오에서도 열려야 한다 — 정작 그런 결과가
     질문이 없어 막혀 있을 가능성이 높다. */
  const service = read("server/portfolio/request-questions.ts");
  assert.doesNotMatch(service, /generatePortfolio|openai|loadEvidence|generation_evidence/u);
});

test("오류 코드 목록을 한 곳에서만 정한다", () => {
  /* 서버가 목록을 따로 복제하고 있었다. 계약에 코드를 더해도 라우트가 그것을
     쓸 수 없었고, 타입이 어긋남을 막아주지 않아 새 코드를 쓰는 쪽에서
     뒤늦게 터졌다. */
  const http = read("server/http.ts");
  assert.match(http, /import type \{ ApiErrorCode \} from "@\/contracts\/api-contract"/u);
  assert.doesNotMatch(http, /type ApiErrorCode =/u, "오류 코드 목록이 다시 복제됐어요");
});

test("목이 서버와 같은 질문을 낸다", () => {
  /* 목은 서버 모듈을 가져올 수 없다 — 가져오면 서버 코드가 화면 번들에
     실린다. 그래서 문구를 각자 적는데, 그러면 로컬에서 보고 고친 화면과
     배포된 화면이 달라진다. 여기서 둘을 묶어둔다.

     제목 자리는 목에서 템플릿이라 그 모양 그대로 넣어 비교한다. */
  const mock = read("lib/api-client/adapters/mock/index.ts");
  const made = [
    ...buildRequestedQuestions("keyDecision", "ledger-sync", "${project.title}"),
    ...buildRequestedQuestions("highlights", "ledger-sync", "${project.title}"),
  ];

  for (const item of made) {
    assert.ok(mock.includes(item.question), `목에 없는 문구예요:\n  ${item.question}`);
    if (item.topic) assert.ok(mock.includes(item.topic), `목의 topic이 달라요: ${item.topic}`);
  }
});
