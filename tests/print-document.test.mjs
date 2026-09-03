import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * 종이에 찍히는 문서가 화면에서 본 것과 같고, 색이 살아 있게 지킨다.
 *
 * 인쇄 결과는 DOM 러너 없이 증명할 수 없다. 대신 **그것을 만드는 장치가
 * 제거되지 않았는지**를 지킨다. 여기 걸린 두 가지는 실제로 사용자가 겪은
 * 증상이라 회귀하면 바로 보인다 — 하나는 "차트가 색칠이 안 되어 있다",
 * 다른 하나는 종이에 찍힌 "Back to top ↑"이다.
 */

const root = new URL("..", import.meta.url).pathname;
const css = readFileSync(root + "app/globals.css", "utf8");
const preview = readFileSync(root + "components/portfolio/PortfolioPreview.tsx", "utf8");

/** `@media print { … }` 블록만 잘라낸다. 중괄호 깊이로 끝을 찾는다. */
function printBlock() {
  /* 주석에도 "@media print"라는 글자가 나온다. 줄 첫머리의 실제 at-rule만 찾는다. */
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

test("인쇄에서 색을 강제하는 곳은 언어 막대 채움 하나뿐이다", () => {
  /* 이 속성은 상속된다. 전역이나 조상에 걸면 히어로 그라데이션 같은 장식까지
     살아나 잉크를 쓰고, 앞으로 누가 장식 배경을 추가할 때마다 조용히 종이에
     찍힌다. 실패가 인쇄해 보기 전까지 보이지 않는 종류라 못을 박는다. */
  const rules = [...css.matchAll(/([^{}]+)\{[^}]*print-color-adjust:[^}]*\}/gu)]
    .map((match) => match[1].trim().split("\n").pop().trim())
    .filter((selector) => !selector.startsWith("-webkit"));

  assert.deepEqual(
    [...new Set(rules)],
    [".result-language-fill"],
    `print-color-adjust가 채움 말고 다른 곳에 걸렸어요: ${rules.join(", ")}`,
  );

  const block = printBlock();
  assert.match(block, /print-color-adjust:\s*exact/u, "인쇄 블록에 색 강제가 없어요");
  // Safari는 접두사만 안다.
  assert.match(block, /-webkit-print-color-adjust:\s*exact/u, "Safari용 접두사가 없어요");
});

test("색이 빠져도 막대 길이가 읽힌다", () => {
  /* Firefox는 print-color-adjust를 아예 지원하지 않는다. 배경이 빠져도
     오른쪽 끝의 눈금(border)과 퍼센트 숫자로 길이가 읽혀야 한다. */
  const fill = css.match(/\.result-language-fill\s*\{([^}]*)\}/u);
  assert.ok(fill, ".result-language-fill 규칙이 없어요");
  assert.match(fill[1], /border-right:/u, "배경이 빠졌을 때 남을 눈금이 없어요");

  // 숫자와 이름은 색과 무관한 채널이다. 둘 다 있어야 한다.
  assert.match(preview, /\{language\.percentage\}%/u, "퍼센트 숫자가 없어요");
  assert.match(preview, /\{language\.name\}/u, "언어 이름이 없어요");
});

test("인쇄가 막대를 흑백으로 되돌리지 않는다", () => {
  // 예전에는 채움을 var(--result-ink)로 덮었는데, 그것도 background라 사라졌다.
  const block = printBlock();
  assert.doesNotMatch(
    block,
    /\.result-language-fill\s*\{[^}]*background:/u,
    "인쇄에서 채움 색을 덮어쓰고 있어요",
  );
});

test("어느 보기에서 인쇄해도 종이 조판이 같다", () => {
  /* `.result-paper`는 A4 낱장 경로에만 붙는데, 인쇄할 때 브라우저는 종이
     폭(794px)으로 다시 레이아웃한다. 그 값이 A4_MIN_WIDTH(900)보다 작아
     문서가 읽기 보기로 뒤집히고, 그 경로에는 이 클래스가 없다. 그래서
     미리보기와 인쇄가 달랐다. 인쇄 블록이 같은 값을 직접 들고 있어야 한다. */
  const block = printBlock();
  for (const [rule, label] of [
    [/--doc-gutter:\s*var\(--space-6\)/u, "문서 기준선"],
    [/\.result-portfolio-hero\s*\{[^}]*padding-top:\s*var\(--space-4\)/u, "히어로 여백"],
    [/\.result-project-card\s*\{[^}]*padding:\s*var\(--space-3\)/u, "프로젝트 카드 여백"],
  ]) {
    assert.match(block, rule, `인쇄 블록에 ${label} 규칙이 없어요`);
  }
});

test("화면 전용 요소가 종이에 남지 않는다", () => {
  /* "Back to top ↑"은 종이에서 아무 의미가 없다. 실제로 찍혀 나가고 있었다. */
  const block = printBlock();
  assert.match(
    block,
    /\.result-portfolio-footer\s*\{\s*display:\s*none/u,
    "꼬리말이 인쇄에서 숨겨지지 않아요",
  );
  assert.match(block, /\.result-portfolio-nav,/u, "목차가 인쇄에서 숨겨지지 않아요");
});

test("언어 목록이 구조 선택자에 기대지 않는다", () => {
  /* 예전에는 `> div > div:first-child` 같은 선택자로만 걸려 있어, 마크업을
     한 줄만 바꿔도 화면과 인쇄 규칙 다섯 곳이 동시에 떨어졌다. */
  assert.doesNotMatch(css, /\.result-language-list\s*>\s*div/u, "구조 선택자가 남아 있어요");
  for (const name of ["result-language-row", "result-language-track", "result-language-fill"]) {
    assert.ok(css.includes(`.${name}`), `${name} 규칙이 없어요`);
    assert.ok(preview.includes(name), `${name}이 마크업에 없어요`);
  }
});

test("언어 막대가 무엇인지 밝힌다", () => {
  /* 이력서의 스킬 막대가 비판받는 이유는 "70%"의 기준을 알 수 없기 때문이다.
     이건 자기평가가 아니라 저장소 코드 비율이므로, 그 사실이 보여야 한다. */
  assert.match(preview, /저장소 코드 비율/u, "막대의 출처를 밝히지 않았어요");
});
