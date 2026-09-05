import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * A4 보기가 인쇄를 사실대로 보여주는지 지킨다.
 *
 * 미리보기의 일은 보기 좋게 만드는 것이 아니라 **인쇄되는 모습을 보여주는**
 * 것이다. 미리보기에만 있는 규칙은 전부 거짓말이 된다 — 사용자는 인쇄해
 * 보기 전까지 그 차이를 알 수 없고, 알았을 때는 이미 늦다.
 *
 * 실제로 두 규칙이 있었고, 표지 문구 위치가 최대 254px(한 장의 4분의 1)
 * 어긋났다.
 */

const root = new URL("..", import.meta.url).pathname;
const paginated = readFileSync(root + "components/portfolio/PaginatedPortfolio.tsx", "utf8");
const preview = readFileSync(root + "components/portfolio/PortfolioPreview.tsx", "utf8");

test("남는 공간을 임의로 채우지 않는다", () => {
  /* 인쇄는 위로 붙여 찍는다. 미리보기가 블록 사이를 벌려 아래로 흩뿌리면
     여러 장짜리 문서는 언제나 달라 보인다. 실제로 장마다 34px씩 벌어졌다. */
  for (const gone of ["MAX_FILL_GAP", "FILL_SAFETY", "FILL_GUARD", "gap:"]) {
    assert.ok(!paginated.includes(gone), `${gone}가 되살아났어요`);
  }
  assert.doesNotMatch(paginated, /marginTop/u, "블록 사이에 여백을 넣고 있어요");
});

test("인쇄 엔진에 없는 나눔 규칙을 두지 않는다", () => {
  /* "한 장에 프로젝트 2개까지"가 있었다. 훑기 좋게 하려는 뜻이었지만 인쇄
     엔진에는 그런 규칙이 없어서, 짧은 프로젝트가 셋이면 곧바로 갈라졌다. */
  assert.ok(!paginated.includes("MAX_PROJECTS_PER_PAGE"), "프로젝트 수 제한이 되살아났어요");
  // 넘칠 때만 다음 장으로 넘긴다. 인쇄 엔진이 하는 판단과 같다.
  assert.match(paginated, /used \+ height > CONTENT_HEIGHT/u, "넘침 판단이 없어요");
});

test("재는 DOM과 인쇄되는 DOM이 같은 래퍼를 쓴다", () => {
  /* 한쪽만 <div>로 감싸면 마진 상쇄가 달라 잰 높이와 실제 높이가 어긋나고,
     그 차이가 그대로 미리보기와 인쇄의 차이가 된다. 인쇄는 읽기 보기
     경로를 쓴다 — 종이 폭에서는 낱장 보기가 열리지 않기 때문이다. */
  assert.match(
    preview,
    /blocks\.map\(\(block\) => <div key=\{block\.key\}>\{block\.node\}<\/div>\)/u,
    "읽기 보기가 블록을 감싸지 않아요",
  );
  assert.match(
    paginated,
    /blocks\.map\(\(block\) => <div key=\{block\.key\}>\{block\.node\}<\/div>\)/u,
    "측정 사본이 블록을 감싸지 않아요",
  );
});

test("낱장 규격이 인쇄 @page와 같은 단위를 쓴다", () => {
  /* px로 반올림해 적으면 종이보다 0.5px씩 어긋나고, 그 차이가 줄바꿈 경계에
     걸린 문단에서 한 줄이 되어 쌓인다. 같은 단위로 적어 여지를 없앤다. */
  const css = readFileSync(root + "app/globals.css", "utf8");
  assert.match(css, /--page-w: 210mm; --page-h: 297mm; --page-margin: 8mm;/u);
  assert.match(css, /@page \{[^}]*margin: 8mm;/u, "@page 여백이 8mm가 아니에요");
  assert.match(paginated, /const MM = 96 \/ 25\.4;/u);
  assert.match(paginated, /const PAGE_WIDTH = 210 \* MM;/u);
  assert.match(paginated, /const PAGE_HEIGHT = 297 \* MM;/u);
  assert.match(paginated, /const PAGE_MARGIN = 8 \* MM;/u);
});

test("낱장 안쪽에 테두리를 두지 않는다", () => {
  /* 이 요소는 `.portfolio-preview` 클래스를 함께 달고 있어 문서 테두리를
     물려받았다. 두 가지가 망가졌다.

     보이는 것 — 안쪽 상자가 낱장보다 짧아 테두리 아랫변이 종이 한가운데를
     가로지르는 선으로 남았다.

     안 보이는 것 — 좌우 테두리가 본문 폭을 2px 먹어 미리보기는 732px,
     인쇄는 733.5px에서 줄을 접었다. 긴 문단이 미리보기에서만 한 줄 더 접히고,
     쌓여서 프로젝트 하나가 통째로 다음 장으로 밀렸다. */
  const css = readFileSync(root + "app/globals.css", "utf8");
  const rule = css.match(/\.portfolio-page-inner \{([^}]*)\}/u);
  assert.ok(rule, ".portfolio-page-inner 규칙이 없어요");
  assert.match(rule[1], /border: 0/u, "낱장 안쪽에 테두리가 남아 있어요");
});
