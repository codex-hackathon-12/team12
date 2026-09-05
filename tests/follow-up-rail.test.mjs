import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * 되묻기가 문서 옆에서 이뤄지는지 지킨다.
 *
 * 처음에는 비어 있는 자리에 카드를 직접 끼워 넣었다. 답이 어디로 가는지는
 * 분명했지만 읽는 대상 한가운데 편집 UI가 박혔고, A4 보기에서는 나눔이
 * 어긋나 아예 숨겨야 했다. 여기 걸린 것은 그 둘로 되돌아가는 것을 막는다.
 */

const root = new URL("..", import.meta.url).pathname;
const read = (path) => readFileSync(root + path, "utf8");

const rail = read("components/portfolio/FollowUpRail.tsx");
const documentView = read("components/portfolio/PortfolioDocument.tsx");
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

test("문서 안에 편집 UI를 끼워 넣지 않는다", () => {
  /* 이력서 한가운데 입력 칸이 박히면 읽는 문서가 아니게 된다. 문서가 받는
     것은 "표시할 프로젝트" 목록뿐이다. */
  assert.doesNotMatch(preview, /renderProjectSlot/u, "문서에 요소를 끼우는 통로가 남아 있어요");
  assert.doesNotMatch(documentView, /renderProjectSlot/u, "문서에 요소를 끼우는 통로가 남아 있어요");
  assert.match(preview, /markedProjectUrls/u, "표시할 프로젝트를 받지 않아요");
});

test("A4 보기에서도 되묻기가 살아 있다", () => {
  /* 예전에는 화면 전용 카드가 나눔을 어긋나게 해서 A4 보기에서 되묻기를
     숨기고 읽기 보기를 강제로 열었다. 막다른 길을 가린 것이지 고친 것이
     아니었다. 패널이 문서 밖으로 나오면서 그 회피책이 필요 없어졌다. */
  assert.doesNotMatch(documentView, /hasOpenQuestions/u, "읽기 보기 강제가 남아 있어요");
  assert.match(documentView, /useState\(true\)/u, "A4 보기로 시작하지 않아요");
});

test("문서 표시가 자리를 차지하지 않는다", () => {
  /* border나 padding을 쓰면 블록 높이가 달라져 A4 나눔이 인쇄와 어긋난다.
     그것 때문에 예전에 되묻기를 숨겨야 했다. outline은 자리를 차지하지 않는다. */
  const rule = css.match(/\.result-block-marked\s*\{([^}]*)\}/u);
  assert.ok(rule, ".result-block-marked 규칙이 없어요");
  assert.match(rule[1], /outline:/u);
  assert.doesNotMatch(rule[1], /(?:^|[^-])(?:border|padding|margin)/u, "표시가 레이아웃을 건드려요");
});

test("숨은 측정 사본을 잡지 않는다", () => {
  /* A4 보기에서는 같은 data 속성이 DOM에 두 번 있다. 하나는 높이를 재려고
     화면 밖에 그려둔 사본이라, 그쪽을 잡으면 스크롤도 강조도 보이지 않는
     곳에서 일어난다. */
  assert.match(rail, /closest\("\.portfolio-pages-measure"\)/u, "측정 사본을 걸러내지 않아요");
});

test("남에게 보내는 문서에는 되묻기가 새어 나가지 않는다", () => {
  for (const path of ["app/p/[slug]/page.tsx", "app/(dashboard)/gallery/[exampleId]/page.tsx"]) {
    assert.doesNotMatch(read(path), /markedProjectUrls|FollowUpRail/u, `${path}가 되묻기를 넘기고 있어요`);
  }
  assert.match(resultPage, /markedProjectUrls=\{/u, "결과 화면이 표시를 안 넘겨요");
});

test("패널이 문서를 가리지 않는다", () => {
  /* 겹치면 읽으면서 답할 수 없다. 문서를 패널 폭만큼 밀어낸다. 캔버스 여백이
     100vw를 쓰면 패널이 차지한 폭을 몰라 문서가 가운데를 벗어난다. */
  assert.match(css, /\.result-page \{ --rail-width: 0px; padding-right: var\(--rail-width\); \}/u);
  assert.match(css, /\.portfolio-canvas-wrap \{[\s\S]*?calc\(\(100% - 1360px\) \/ 2\)/u, "캔버스가 패널 폭을 몰라요");
});

test("좁은 화면에서는 아래에서 올라온다", () => {
  // 옆에 둘 자리가 없는 폭에서 패널이 문서를 덮으면 읽을 수가 없다.
  assert.match(css, /@media \(max-width: 1100px\) \{[\s\S]*?\.result-page\.with-rail \{ --rail-width: 0px; \}/u);
});

test("패널이 종이에 찍히지 않는다", () => {
  assert.match(printBlock(), /\.follow-up-rail,/u, "패널이 인쇄에서 숨겨지지 않아요");
});

test("결정은 세 가지를 다 받아야 보낸다", () => {
  assert.match(rail, /isDecision && answered\.length < group\.questions\.length/u);
  assert.match(rail, /세 가지를 다 알려주셔야/u, "왜 안 되는지 말해주지 않아요");
});

test("진행 표시를 반드시 되돌린다", () => {
  assert.match(rail, /\} finally \{\s*(?:\/\*[\s\S]*?\*\/\s*)?setSubmitting\(false\);/u);
});

test("답변 상한을 계약에서 가져온다", () => {
  assert.match(rail, /PORTFOLIO_ANSWER_MAX_LENGTH/u);
  assert.doesNotMatch(rail, /600/u, "상한 숫자를 화면에 직접 적었어요");
});

test("수치를 요구하지 않는다", () => {
  assert.match(rail, /수치가 없어도 괜찮아요/u);
});
