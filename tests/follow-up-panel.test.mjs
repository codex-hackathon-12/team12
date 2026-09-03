import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * 되묻기 화면이 제 역할을 하는지 지킨다.
 *
 * DOM 러너가 없어 렌더 결과는 증명할 수 없다. 대신 **틀어지면 기능이 조용히
 * 무의미해지는 배치와 연결**을 지킨다. 여기 걸린 것은 전부 "동작은 하는데
 * 아무도 못 보거나, 보면 안 되는 곳에 보이는" 종류의 실패다.
 */

const root = new URL("..", import.meta.url).pathname;
const read = (path) => readFileSync(root + path, "utf8");

const panel = read("components/portfolio/FollowUpPanel.tsx");
const page = read("app/(dashboard)/portfolios/[portfolioId]/page.tsx");
const css = read("app/globals.css");

test("물어보는 칸이 문서보다 위에 온다", () => {
  /* 아래에 두면 답할 것이 있다는 사실 자체를 못 보고 나간다. 문서는 길어서
     끝까지 스크롤할 이유가 없다. */
  const panelAt = page.indexOf("<FollowUpPanel");
  const documentAt = page.indexOf("<PortfolioDocument");
  assert.notEqual(panelAt, -1, "결과 화면에 되묻기 칸이 없어요");
  assert.notEqual(documentAt, -1, "결과 화면에 문서가 없어요");
  assert.ok(panelAt < documentAt, "되묻기 칸이 문서 아래에 있어요");
});

test("반영 결과가 화면에 바로 반영된다", () => {
  /* 답을 보내고 문서가 그대로면 사용자는 아무 일도 안 일어났다고 본다.
     다시 불러오기를 시키지 않고 응답을 그대로 쓴다. */
  assert.match(page, /rewritten\?\.content \?\? portfolio\.content/u, "문서가 반영 결과를 안 봐요");
  assert.match(page, /rewritten\?\.questions \?\? portfolio\.questions/u, "질문 목록이 반영 결과를 안 봐요");
});

test("물어보는 칸은 종이에 찍히지 않는다", () => {
  /* 종이에 남으면 채용 담당자가 지원자에게 던지는 질문 목록이 된다.
     "이 프로젝트에서 어떤 부분을 맡으셨나요?"가 이력서에 인쇄된다. */
  const start = css.search(/^@media print/mu);
  assert.notEqual(start, -1, "@media print 블록이 없어요");
  let depth = 0;
  let block = "";
  for (let i = css.indexOf("{", start); i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    else if (css[i] === "}") {
      depth -= 1;
      if (depth === 0) {
        block = css.slice(start, i + 1);
        break;
      }
    }
  }
  assert.match(block, /\.follow-up,/u, "되묻기 칸이 인쇄에서 숨겨지지 않아요");
});

test("답변 상한을 계약에서 가져와 화면에 밝힌다", () => {
  /* 상한을 화면에 안 적으면 서버가 조용히 자르거나 400을 돌려준다. 둘 다
     사용자는 이유를 모른다. 숫자를 여기 적어두면 계약과 갈라진다. */
  assert.match(panel, /PORTFOLIO_ANSWER_MAX_LENGTH/u, "상한을 계약에서 안 가져와요");
  assert.doesNotMatch(panel, /600/u, "상한 숫자를 화면에 직접 적었어요");
  assert.match(panel, /자 이내로 줄여주세요/u, "넘겼을 때 알려주지 않아요");
});

test("어느 프로젝트의 무엇을 묻는지 밝힌다", () => {
  // 답을 어디에 쓸지 알아야 답의 범위가 정해진다.
  assert.match(panel, /follow-up-target/u, "질문 대상 표시가 없어요");
  assert.ok(css.includes(".follow-up-target"), "질문 대상 표시 규칙이 없어요");
});

test("수치를 요구하지 않는다", () => {
  /* 화면이 수치를 요구하면 사용자는 없는 수치를 만들어 적는다. 지어낸 수치는
     면접의 후속 질문 하나에 무너진다 — 제품이 그걸 부추기면 안 된다. */
  assert.match(panel, /수치가 없어도 괜찮아요/u, "수치 없이도 된다고 말하지 않아요");
});

test("부분 반영을 막지 않는다", () => {
  // 세 질문 중 하나만 답하고 싶은 사람이 아무것도 보낼 수 없으면 안 된다.
  assert.match(panel, /모두 답하지 않아도 괜찮아요/u, "일부만 답해도 된다고 안 알려요");
});

test("근거가 사라진 결과는 다시 시도하라고 하지 않는다", () => {
  /* 같은 문구로 뭉뚱그리면 사용자가 될 때까지 누르게 된다. 이 실패는
     재시도로 풀리지 않는다. */
  assert.match(panel, /EVIDENCE_UNAVAILABLE/u, "되살릴 수 없는 실패를 구분하지 않아요");
});
