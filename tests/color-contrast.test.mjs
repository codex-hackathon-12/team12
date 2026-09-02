import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * 색 대비를 스타일시트에서 직접 읽어 검사한다.
 *
 * 대비는 눈으로 판단할 수 없고, 자동 검사 도구(axe, Lighthouse)는 실행할 DOM이
 * 있어야 한다. 토큰 값은 CSS 안에 문자열로 있으니 그것만 읽어 계산하면 3,000줄짜리
 * 스타일시트가 검사 가능한 약속이 된다.
 *
 * 통과하는 조합도 함께 넣는다. 나중에 누가 "조금만 더 연하게" 바꾸는 것을 잡는 게
 * 이 테스트의 진짜 목적이다.
 */

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

/** `:root { --token: #hex; }`에서 토큰만 뽑는다. */
function readTokens(source) {
  const root = source.slice(source.indexOf(":root"), source.indexOf("}", source.indexOf(":root")));
  const tokens = {};
  for (const [, name, value] of root.matchAll(/(--[a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/gu)) {
    tokens[name] = value;
  }
  return tokens;
}

function channel(value) {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const value = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a, b) {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

const tokens = readTokens(css);
const hex = (name) => {
  const value = tokens[name];
  assert.ok(value, `${name} 토큰을 찾지 못했어요`);
  return value;
};

test("팔레트 토큰이 모두 정의돼 있다", () => {
  for (const name of [
    "--paper", "--paper-deep", "--surface", "--ink", "--ink-soft", "--ink-muted",
    "--line", "--line-dark", "--line-control", "--lime", "--lime-soft",
    "--coral", "--coral-bright", "--blue",
  ]) {
    assert.match(hex(name), /^#[0-9a-f]{6}$/iu, `${name} 값이 6자리 hex가 아니에요`);
  }
});

// [전경, 배경, 최소비, 설명]
const TEXT_PAIRS = [
  ["--ink", "--paper", 4.5, "본문"],
  ["--ink", "--surface", 4.5, "카드 위 본문"],
  ["--ink-soft", "--paper", 4.5, "보조 설명 — 통과하고 있으니 그대로 두기 위한 고정"],
  ["--ink-soft", "--surface", 4.5, "카드 위 보조 설명"],
  ["--ink-soft", "--lime-soft", 4.5, "선택된 행의 보조 설명"],
  ["--ink-muted", "--paper", 4.5, "placeholder·비활성 단계 표시"],
  ["--ink-muted", "--surface", 4.5, "검색 placeholder"],
  ["--coral", "--surface", 4.5, "상한 안내·삭제 링크"],
  ["--coral", "--paper", 4.5, "선택 개수 경고"],
  ["--ink", "--lime", 4.5, "라임 배지 위 글자"],
  ["--ink", "--lime-soft", 4.5, "연한 라임 칩 위 글자"],
];

for (const [fg, bg, min, label] of TEXT_PAIRS) {
  test(`글자 대비: ${label} (${fg} on ${bg})`, () => {
    const ratio = contrast(hex(fg), hex(bg));
    assert.ok(ratio >= min, `${ratio.toFixed(2)}:1 — ${min}:1 이상이어야 해요`);
  });
}

test("흰 글자를 얹는 배경은 흰색 기준으로도 통과해야 한다", () => {
  // 로그아웃 실패 배너, 공지 배지, 위험 버튼이 전부 코랄 배경에 흰 글자다.
  const ratio = contrast("#ffffff", hex("--coral"));
  assert.ok(ratio >= 4.5, `${ratio.toFixed(2)}:1 — 4.5:1 이상이어야 해요`);
});

// UI 요소의 경계는 3:1 (WCAG 1.4.11)
const BOUNDARY_PAIRS = [
  ["--line-control", "--surface", "입력·필터·카드 테두리"],
  ["--line-control", "--paper", "종이 위 폼 테두리"],
  ["--line-control", "--paper-deep", "짙은 바탕 위 폼 테두리"],
  ["--blue", "--paper", "포커스 링"],
  ["--blue", "--surface", "카드 위 포커스 링"],
  ["--blue", "--ink", "어두운 버튼 위 포커스 링"],
  ["--blue", "--lime", "라임 위 포커스 링"],
  ["--ink", "--lime-soft", "진행 막대 채움과 트랙"],
];

for (const [fg, bg, label] of BOUNDARY_PAIRS) {
  test(`경계 대비: ${label} (${fg} on ${bg})`, () => {
    const ratio = contrast(hex(fg), hex(bg));
    assert.ok(ratio >= 3, `${ratio.toFixed(2)}:1 — 3:1 이상이어야 해요`);
  });
}

test("포커스 표시는 한 곳에서만 정의한다", () => {
  /* 예전에는 선언이 세 곳에 흩어져 있었고 목록에 다섯 클래스만 적혀 있어서
     select·textarea·아바타에는 표시가 아예 없었다. */
  /* outline: none으로 끄는 것(본문 컨테이너처럼 프로그램으로만 포커스를 받는 곳)은
     세지 않는다. 세려는 건 "링을 그리는 곳"이다. */
  const drawn = (css.match(/:focus-visible\)?\s*\{[^}]*outline:[^;]*;/gu) ?? []).filter(
    (rule) => !/outline:\s*none/u.test(rule),
  );
  /* 둘째는 결제 상품 카드다. 포커스를 받는 라디오가 시각적으로 숨겨져 있어
     카드가 표시를 대신 그린다 — 규칙을 어기는 게 아니라 위임하는 경우다. */
  assert.equal(drawn.length, 2, `포커스 링을 그리는 선언이 둘이어야 해요 (지금 ${drawn.length}개)`);
  assert.ok(
    css.includes(".product-card:has(:focus-visible)"),
    "상품 카드의 포커스 표시는 :focus-within이 아니라 :focus-visible이어야 해요",
  );
  assert.ok(!css.includes("rgb(97 112 255 / 38%)"), "반투명 포커스 링이 남아 있어요");
});

test("움직임을 줄이는 설정을 존중한다", () => {
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/u);
  // 자동으로 시작해 5초 넘게 움직이는 내용에는 멈출 방법이 있어야 한다(2.2.2).
  /* 로딩 스피너는 "필수 예외"에 해당하므로 제외하고 본다. */
  const withoutSpinner = css.replace(/\.loading-mark[^}]*\}/gu, "");
  assert.ok(
    !/animation:[^;]*infinite/u.test(withoutSpinner),
    "생성 화면 같은 곳에 무한 반복 애니메이션이 남아 있어요",
  );
});
