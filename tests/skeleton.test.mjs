import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * 스켈레톤 — 내용이 올 자리를 그 모양대로 비워 보여준다.
 *
 * 스피너는 "기다리세요"만 말하고 어디에 무엇이 올지는 말하지 않는다. 여기
 * 걸린 것은 자료 화면들이 스피너로 되돌아가는 것과, 스켈레톤이 접근성
 * 계약(상태 알림·움직임 줄이기)을 잃는 것을 막는다.
 */

const root = new URL("..", import.meta.url).pathname;
const read = (path) => readFileSync(root + path, "utf8");

const skeleton = read("components/ui/Skeleton.tsx");
const css = read("app/globals.css");

test("자리 표시가 실물의 클래스를 입는다", () => {
  /* 범용 모양 한 벌로 때웠더니 진짜와 다르게 생겨 화면이 두 번 바뀌는
     것처럼 보였다. 행 높이·칸 나눔·카드 최소 높이가 전부 실제 CSS에서
     오도록, 화면마다 그 화면의 컨테이너 클래스를 그대로 입는다. */
  const shapes = [
    ["RepositoryRowsSkeleton", ["repository-rows", "repository-row", "repository-row-label"]],
    ["PortfolioCardsSkeleton", ["portfolio-list-grid", "portfolio-list-card", "tag-row"]],
    ["GalleryCardsSkeleton", ["gallery-grid", "gallery-card", "gallery-visual"]],
    ["BillingPageSkeleton", ["product-grid", "product-card", "product-radio", "product-price"]],
    ["DashboardPageSkeleton", ["split-section", "recent-list", "recent-item", "notice-panel", "notice-item", "dashboard-strip"]],
    ["SettingsPageSkeleton", ["connection-card"]],
    ["PromptPageSkeleton", ["prompt-layout"]],
    ["DocumentPageSkeleton", ["document-toolbar", "portfolio-canvas-wrap"]],
  ];
  for (const [shape, classes] of shapes) {
    const at = skeleton.indexOf(`function ${shape}`);
    assert.notEqual(at, -1, `${shape}이 없어요`);
    const block = skeleton.slice(at, skeleton.indexOf("\nexport", at + 1) === -1
      ? undefined
      : skeleton.indexOf("\nexport", at + 1));
    for (const cls of classes) {
      assert.match(block, new RegExp(cls, "u"), `${shape}이 실물 클래스 ${cls}를 안 입어요`);
    }
  }
});

test("자료 화면이 자기 모양의 자리를 그린다", () => {
  const pages = [
    ["app/(dashboard)/dashboard/page.tsx", "DashboardPageSkeleton"],
    ["app/(dashboard)/settings/page.tsx", "SettingsPageSkeleton"],
    ["app/(dashboard)/create/[id]/prompt/page.tsx", "PromptPageSkeleton"],
    ["app/(dashboard)/repositories/page.tsx", "RepositoryRowsSkeleton"],
    ["app/(dashboard)/portfolios/page.tsx", "PortfolioCardsSkeleton"],
    ["app/(dashboard)/gallery/page.tsx", "GalleryCardsSkeleton"],
    ["app/(dashboard)/billing/page.tsx", "BillingPageSkeleton"],
    ["app/(dashboard)/portfolios/[portfolioId]/page.tsx", "DocumentPageSkeleton"],
    ["app/(dashboard)/gallery/[exampleId]/page.tsx", "DocumentPageSkeleton"],
  ];
  for (const [path, shape] of pages) {
    const source = read(path);
    assert.match(source, new RegExp(shape, "u"), `${path}가 ${shape}을 안 써요`);
    assert.doesNotMatch(source, /<LoadingState/u, `${path}가 스피너로 돌아갔어요`);
  }
});

test("스켈레톤이 스피너의 접근성 계약을 이어받는다", () => {
  /* 조각은 낭독기에서 빠지고, 화면 묶음이 role="status"와 라벨로 말한다. */
  assert.match(skeleton, /aria-hidden="true" className="skeleton"/u, "조각이 낭독기에 잡혀요");
  const statuses = skeleton.match(/role="status" aria-label=\{label\}/gu) ?? [];
  const shapes = skeleton.match(/export function \w+Skeleton\(/gu) ?? [];
  // "…Skeleton(" 꼴은 화면 묶음뿐이다(조각 Skeleton·SkeletonText는 안 잡힌다).
  assert.equal(statuses.length, shapes.length, "상태를 안 알리는 화면 묶음이 있어요");
});

test("맥동이 움직임 줄이기를 존중한다", () => {
  /* 스피너와 같은 "진행 중" 표시라 무한 반복의 필수 예외에 들지만, 그 자격은
     줄이기 설정에서 멈출 때만이다. */
  assert.match(css, /\.skeleton \{[^}]*animation: skeleton-pulse[^}]*infinite/u, "맥동이 없어요");
  assert.match(css, /prefers-reduced-motion: reduce[\s\S]{0,200}\.skeleton \{ animation: none/u,
    "줄이기 설정을 무시해요");
  // 채움 조각도 같은 예외 조건을 진다.
  assert.match(css, /\.skeleton-fill \{ animation: none/u, "채움 조각이 줄이기 설정을 무시해요");
});

test("종이 자리가 진짜 종이와 같다", () => {
  /* 캔버스는 실물 클래스(.portfolio-canvas-wrap)를 입으므로 종이만 지킨다.
     폭·비율·색이 다르면 진짜가 오는 순간 화면이 덜컥 바뀐다. */
  const paper = css.match(/\.skeleton-paper \{([^}]*)\}/u);
  assert.ok(paper, "종이 자리 규칙이 없어요");
  assert.match(paper[1], /width: min\(794px, 100%\)/u, "종이 폭이 A4 화면 폭과 달라요");
  assert.match(paper[1], /aspect-ratio: 210 \/ 297/u, "A4 비율이 아니에요");
  assert.match(paper[1], /#fffefa/u, "종이 색이 달라요");
});

test("주제를 묶는 동안 주제 카드 자리가 보인다", () => {
  /* 첫 열람은 모델을 기다려 몇 초 걸린다. 빈 화면 대신 올 것의 모양을 그린다. */
  const more = read("components/portfolio/MoreToWrite.tsx");
  assert.match(more, /follow-up-candidate-ghost/u, "주제 카드 자리가 없어요");
  assert.match(more, /role="status" aria-label="저장소 기록을 주제로 묶는 중"/u);
});

test("줄 폭 패턴은 난수가 아니다", () => {
  /* 난수를 쓰면 서버와 클라이언트 렌더가 어긋나 hydration 오류가 난다. */
  assert.doesNotMatch(skeleton, /Math\.random/u);
});
