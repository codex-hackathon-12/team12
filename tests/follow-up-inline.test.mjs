import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * 되묻기가 문서 안 그 자리에서 이뤄지는지 지킨다.
 *
 * DOM 러너가 없어 렌더 결과는 증명할 수 없다. 대신 **틀어지면 조용히 위험해지는
 * 연결**을 지킨다. 여기 걸린 것 중 둘은 사고에 가깝다 — 공개 링크에 질문이
 * 새어 나가는 것과, 인쇄물에 질문 목록이 찍히는 것이다.
 */

const root = new URL("..", import.meta.url).pathname;
const read = (path) => readFileSync(root + path, "utf8");

const inline = read("components/portfolio/InlineFollowUp.tsx");
const document = read("components/portfolio/PortfolioDocument.tsx");
const preview = read("components/portfolio/PortfolioPreview.tsx");
const resultPage = read("app/(dashboard)/portfolios/[portfolioId]/page.tsx");
const css = read("app/globals.css");

function printBlock() {
  const start = css.search(/^@media print/mu);
  assert.notEqual(start, -1, "@media print 블록이 없어요");
  let depth = 0;
  for (let i = css.indexOf("{", start); i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    else if (css[i] === "}") {
      depth -= 1;
      if (depth === 0) return css.slice(start, i + 1);
    }
  }
  throw new Error("@media print 블록이 닫히지 않았어요");
}

test("남에게 보내는 문서에는 질문이 새어 나가지 않는다", () => {
  /* 공개 링크와 갤러리는 슬롯을 넘기지 않는다. 문서 컴포넌트가 되묻기를
     스스로 그리는 구조였다면 이 사고를 막을 방법이 없다. */
  for (const path of ["app/p/[slug]/page.tsx", "app/(dashboard)/gallery/[exampleId]/page.tsx"]) {
    assert.doesNotMatch(read(path), /renderProjectSlot/u, `${path}가 되묻기 슬롯을 넘기고 있어요`);
  }
  // 결과 화면만 넘긴다.
  assert.match(resultPage, /renderProjectSlot=\{/u, "결과 화면이 슬롯을 안 넘겨요");
});

test("A4 보기에는 화면 전용 요소를 끼우지 않는다", () => {
  /* A4 보기는 실제 인쇄 배치를 재는 미리보기다. 화면에만 있는 카드가 끼면
     페이지가 넘어가는 지점이 실제 인쇄와 어긋난다. */
  assert.match(
    document,
    /renderProjectSlot=\{paginated \? undefined : renderProjectSlot\}/u,
    "A4 보기에서도 슬롯이 그려질 수 있어요",
  );
});

test("답할 것이 있으면 손볼 수 있는 보기로 시작한다", () => {
  // A4 보기로 열리면 되묻기가 아예 보이지 않아 있는 줄도 모른다.
  assert.match(document, /useState\(!hasOpenQuestions\)/u, "읽기 보기로 시작하지 않아요");
  // 그래도 A4 보기로 옮겨간 사람에게는 어디로 가야 하는지 알려야 한다.
  assert.match(document, /읽기 보기에서 채울 수 있어요/u, "A4 보기가 막다른 길이에요");
});

test("되묻기 카드는 종이에 찍히지 않는다", () => {
  /* 종이에 남으면 채용 담당자가 지원자에게 던지는 질문 목록이 된다.
     "이 프로젝트에서 어떤 부분을 맡으셨나요?"가 이력서에 인쇄된다. */
  const block = printBlock();
  assert.match(block, /\.follow-up-slot,/u, "되묻기 카드가 인쇄에서 숨겨지지 않아요");
  assert.match(block, /\.document-pending,/u, "A4 보기 안내가 인쇄에서 숨겨지지 않아요");
});

test("결정은 세 가지를 다 받아야 보낸다", () => {
  /* 하나만 보내면 서버가 반영하지 않는다. 보낸 뒤에 알게 되면 사용자에게는
     "답했는데 아무것도 안 바뀐다"로 보인다. */
  assert.match(inline, /isDecision && answered\.length < group\.questions\.length/u);
  assert.match(inline, /세 가지를 다 알려주셔야/u, "왜 안 되는지 말해주지 않아요");
});

test("무엇에 대한 질문인지 밝힌다", () => {
  // 답을 어디에 쓸지 알아야 답의 범위가 정해진다.
  assert.match(inline, /group\.topic \? <p className="follow-up-topic">/u, "질문 대상 표시가 없어요");
  assert.ok(css.includes(".follow-up-topic"), "질문 대상 표시 규칙이 없어요");
});

test("진행 표시를 반드시 되돌린다", () => {
  /* 성공하면 카드가 사라지지만, 서버가 아무것도 반영하지 못해 카드가 남는
     경우가 있다. 그때 되돌리지 않으면 버튼이 영영 "다시 쓰는 중…"에 머문다. */
  assert.match(inline, /\} finally \{\s*(?:\/\*[\s\S]*?\*\/\s*)?setSubmitting\(false\);/u);
});

test("답변 상한을 계약에서 가져와 화면에 밝힌다", () => {
  /* 상한을 화면에 안 적으면 서버가 400을 돌려주고, 사용자는 이유를 모른다.
     숫자를 여기 적어두면 계약과 갈라진다. */
  assert.match(inline, /PORTFOLIO_ANSWER_MAX_LENGTH/u, "상한을 계약에서 안 가져와요");
  assert.doesNotMatch(inline, /600/u, "상한 숫자를 화면에 직접 적었어요");
});

test("수치를 요구하지 않는다", () => {
  /* 화면이 수치를 요구하면 사용자는 없는 수치를 만들어 적는다. 지어낸 수치는
     면접의 후속 질문 하나에 무너진다 — 제품이 그걸 부추기면 안 된다. */
  assert.match(inline, /수치가 없어도 괜찮아요/u);
});

test("문서는 되묻기를 알지 못한다", () => {
  /* 문서가 되묻기를 직접 import하면 공개 페이지에서도 그릴 수 있게 된다.
     받는 것은 노드뿐이고 무엇이 들어오는지는 부르는 쪽이 정한다. */
  assert.doesNotMatch(preview, /InlineFollowUp/u, "문서가 되묻기를 직접 알고 있어요");
  assert.doesNotMatch(document, /InlineFollowUp/u, "문서가 되묻기를 직접 알고 있어요");
});
