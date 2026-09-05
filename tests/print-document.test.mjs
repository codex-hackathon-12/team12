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

test("문서의 세로 리듬을 한 곳에서만 정한다", () => {
  /* 예전에는 같은 속성이 기본 규칙, `.result-paper`, `@media print` 세 곳에
     있었다. 그중 하나가 특정도 (0,2,0)으로 올라가 `:first-child`를 이기는
     바람에 A4 보기에서만 카드마다 12px이 더 붙었다. 같은 값을 적은 두 줄이
     서로 다른 결과를 낸 것이다.

     값을 토큰으로 빼고 규칙을 한 번만 선언하면 그 일이 일어날 수 없다.
     여기서 지키는 것은 그 구조다. */
  const paper = css.slice(css.indexOf(".result-paper {"), css.indexOf(".portfolio-pages-measure"));
  for (const [source, label] of [[paper, "A4 경로"], [printBlock(), "인쇄"]]) {
    for (const property of ["padding-top", "padding-bottom", "padding-block", "margin-top"]) {
      const offenders = [...source.matchAll(new RegExp(`(\\.result-[a-z-]+[^{}]*)\\{[^}]*${property}:`, "gu"))]
        .map((match) => match[1].trim());
      assert.deepEqual(offenders, [], `${label}가 세로 여백을 다시 적고 있어요: ${offenders.join(", ")}`);
    }
  }
});

test("종이에서 덮어쓰는 것은 좌우 기준선뿐이다", () => {
  /* 세로 여백을 화면과 종이가 다르게 가져갈 이유가 없다. 종이만 좁혔던
     이유(한 장에 더 담기)는 공간 채우기를 걷어내면서 사라졌다. 좌우는
     본문 폭이 733px이라 한 단계 줄인다. */
  assert.match(css, /\.result-paper \{ --doc-gutter: var\(--space-6\); \}/u);
  assert.match(printBlock(), /\.result-portfolio-preview \{ --doc-gutter: var\(--space-6\); \}/u);

  // 세로 토큰은 종이에서 다시 정하지 않는다.
  for (const token of ["--doc-hero-pad", "--doc-project-pad", "--doc-section-gap", "--doc-block-gap"]) {
    assert.equal(
      [...css.matchAll(new RegExp(`${token}:`, "gu"))].length,
      1,
      `${token}이 두 곳에서 정의됐어요`,
    );
  }
});

test("프로젝트 구분선을 :first-child로 가리지 않는다", () => {
  /* 카드가 저마다 자기 블록 안에 하나씩 들어 있어 전부 `:first-child`다.
     그래서 첫 번째만 가리려던 규칙이 모든 카드의 위 여백과 구분선을 지웠고,
     선은 한 번도 그려진 적이 없으며 프로젝트 사이 간격도 절반이었다. */
  assert.doesNotMatch(css, /\.result-project-card:first-child/u, "다시 :first-child로 가리고 있어요");
  // 앞에도 프로젝트가 있을 때만 긋는다.
  assert.match(
    css,
    /div:has\(> \[data-project-url\]\) \+ div:has\(> \[data-project-url\]\) \.result-project-card/u,
    "프로젝트 사이 구분선 규칙이 없어요",
  );
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

test("활자 위계가 뒤집히지 않는다", () => {
  /* 이름 h1의 CSS 선택자가 `.result-hero-copy h1`이었는데 실제 h1은 다른
     자리에 있어 한 번도 매칭되지 않았다. 30px를 의도해 놓고 브라우저
     기본값으로 렌더돼, 본인 이름이 프로젝트 제목보다 작았다. */
  assert.match(preview, /className="result-hero-name"/u, "이름에 클래스가 없어요");
  assert.match(css, /^\.result-hero-name\s*\{/mu, "이름 규칙이 없어요");

  const token = (name) => {
    const match = css.match(new RegExp(`--doc-${name}:\\s*([^;]+);`, "u"));
    assert.ok(match, `--doc-${name} 토큰이 없어요`);
    const value = match[1].trim();
    // var(--text-*)로 넘긴 것은 그 값을 다시 찾는다.
    const ref = value.match(/var\((--text-[a-z0-9]+)\)/u);
    const raw = ref ? css.match(new RegExp(`${ref[1]}:\\s*([0-9.]+)px`, "u"))[1] : value;
    return parseFloat(raw);
  };

  const name = token("name");
  const title = token("title");
  const lead = token("lead");
  const body = token("body");
  const label = token("label");

  assert.ok(name > title, `이름(${name}px)이 프로젝트 제목(${title}px)보다 커야 해요`);
  assert.ok(title > lead, `제목(${title}px)이 본문(${lead}px)보다 커야 해요`);
  assert.ok(lead >= body, `소개(${lead}px)가 본문(${body}px)보다 작으면 안 돼요`);
  assert.ok(body > label, `본문(${body}px)이 라벨(${label}px)보다 커야 해요`);

  /* 인쇄물에서 10pt 미만은 읽기 어렵다. 본문 티어는 이 하한을 지킨다.
     라벨은 대문자 모노 표지판이라 9pt로 예외를 두고, 그 판단을 여기 남긴다. */
  assert.ok(body >= 13.33, `본문이 10pt 미만이에요 (${body}px = ${body * 0.75}pt)`);
  assert.ok(label >= 12, `라벨이 9pt 미만이에요 (${label}px)`);
});

test("문서 활자는 전역 토큰을 직접 쓰지 않는다", () => {
  /* 전역 --text-*는 화면 UI의 값이라 종이 기준과 다르다. 문서 규칙이 직접
     쓰면 화면을 손볼 때 종이가 같이 움직인다. --doc-*를 거쳐야 한다. */
  const offenders = [];
  for (const match of css.matchAll(/(\.result-[a-z-]+[^{}]*)\{([^}]*)\}/gu)) {
    const [, selector, body] = match;
    const size = body.match(/font-size:\s*var\((--text-[a-z0-9]+)\)/u);
    if (size) offenders.push(`${selector.trim().split("\n").pop().trim()} → ${size[1]}`);
  }
  assert.deepEqual(
    offenders,
    [],
    `문서 규칙이 전역 타입 토큰을 직접 쓰고 있어요:\n${offenders.join("\n")}`,
  );
});

/**
 * 프로젝트 카드가 나열에서 결정으로 바뀐 뒤 지켜야 할 것.
 *
 * 짧은 불릿 열몇 개는 전부 같은 무게라 인과가 끊긴 채 놓인다. 면접관이 읽는
 * 것은 나열이 아니라 결정이다. 여기 걸린 것은 그 구조가 조용히 되돌아가거나,
 * 예전 결과가 화면에서 사라지는 것을 막는다.
 */

test("결정이 없으면 그 블록을 그리지 않는다", () => {
  /* 근거에 "왜"가 없으면 초안이 네 값을 비운다. 비어 있는데 라벨만 그리면
     채용 담당자에게 빈칸이 보인다. */
  assert.match(preview, /\{project\.keyDecision\.headline && \(/u, "결정 블록에 조건이 없어요");
  assert.ok(css.includes(".result-decision"), "결정 블록 규칙이 없어요");
});

test("예전에 저장된 결과도 그대로 그린다", () => {
  /* challenges·solutions·impact는 이미 저장된 포트폴리오가 들고 있다. 이
     경로를 지우면 그 사람들의 문서에서 문장이 사라진다. */
  assert.match(preview, /storyColumns\(project\)/u, "예전 경로가 사라졌어요");
  // 다만 결정이 있으면 같은 내용을 두 모양으로 두 번 보여주지 않는다.
  assert.match(
    preview,
    /!project\.keyDecision\.headline && storyColumns\(project\)/u,
    "결정과 예전 열이 함께 그려질 수 있어요",
  );
});

test("결정이 인쇄에서 중간에 끊기지 않는다", () => {
  // 문제와 결과가 다른 장에 놓이면 무슨 이야기인지 알 수 없다.
  assert.match(printBlock(), /\.result-decision,/u, "결정에 break-inside 규칙이 없어요");
});

test("맥락 줄은 없는 값의 칸을 만들지 않는다", () => {
  /* 기간을 계산할 수 없는 저장소가 있다. 빈칸이나 "미상"을 넣으면 사실이
     아닌 값이 문서에 박힌다. */
  assert.match(preview, /\.filter\(Boolean\)\s*\n\s*\.join\(" · "\)/u, "빈 값을 걸러내지 않아요");
});

test("한국어 표지에 대문자 변환을 쓰지 않는다", () => {
  /* text-transform: uppercase는 한글에 아무 일도 하지 않고, 함께 붙는 자간만
     남아 글자 사이가 뜬 것처럼 보인다. */
  const rule = css.match(/\.result-highlight-caption\s*\{([^}]*)\}/u);
  assert.ok(rule, ".result-highlight-caption 규칙이 없어요");
  assert.doesNotMatch(rule[1], /text-transform/u, "한국어 표지에 대문자 변환이 걸렸어요");
});
