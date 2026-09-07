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

test("자료 화면은 자리 모양을 그린다", () => {
  /* 화면마다 올 것의 모양이 다르다 — 행 목록, 카드, 문서. 모양이 맞아야
     진짜가 왔을 때 화면이 덜컥 바뀌지 않는다. */
  /* 화면 전체를 대신하는 자리는 제목 줄까지, 화면이 제목·도구줄을 이미
     그리고 있으면 맨몸(행·카드만) — 제목까지 다시 그리면 진짜와 겹쳐 두
     벌이 된다. */
  const pages = [
    ["app/(dashboard)/dashboard/page.tsx", "ListPageSkeleton"],
    ["app/(dashboard)/settings/page.tsx", "ListPageSkeleton"],
    ["app/(dashboard)/create/[id]/prompt/page.tsx", "ListPageSkeleton"],
    ["app/(dashboard)/repositories/page.tsx", "SkeletonRows"],
    ["app/(dashboard)/portfolios/page.tsx", "SkeletonCards"],
    ["app/(dashboard)/gallery/page.tsx", "SkeletonCards"],
    ["app/(dashboard)/billing/page.tsx", "CardsPageSkeleton"],
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
  /* 조각은 낭독기에서 빠지고, 묶음이 role="status"와 라벨로 말한다. */
  assert.match(skeleton, /aria-hidden="true" className="skeleton"/u, "조각이 낭독기에 잡혀요");
  for (const shape of ["ListPageSkeleton", "CardsPageSkeleton", "DocumentPageSkeleton"]) {
    const block = skeleton.slice(skeleton.indexOf(`function ${shape}`));
    assert.match(block.slice(0, 400), /role="status" aria-label=\{label\}/u, `${shape}이 상태를 안 알려요`);
  }
  /* 빈 라벨의 role="status"는 무엇을 기다리는지 말하지 않는 알림이다.
     라벨이 없으면 장식으로 빠져야 한다. */
  assert.match(skeleton, /label \? \(\{ role: "status"/u);
  assert.match(skeleton, /"aria-hidden": true/u);
});

test("맥동이 움직임 줄이기를 존중한다", () => {
  /* 스피너와 같은 "진행 중" 표시라 무한 반복의 필수 예외에 들지만, 그 자격은
     줄이기 설정에서 멈출 때만이다. */
  assert.match(css, /\.skeleton \{[^}]*animation: skeleton-pulse[^}]*infinite/u, "맥동이 없어요");
  assert.match(css, /prefers-reduced-motion: reduce[\s\S]{0,200}\.skeleton \{ animation: none/u,
    "줄이기 설정을 무시해요");
});

test("문서 자리가 진짜 문서와 같은 색 위에 선다", () => {
  /* 캔버스·종이 색이 다르면 진짜가 오는 순간 배경이 덜컥 바뀐다. */
  const canvas = css.match(/\.skeleton-canvas \{([^}]*)\}/u);
  const paper = css.match(/\.skeleton-paper \{([^}]*)\}/u);
  assert.ok(canvas && paper, "문서 자리 규칙이 없어요");
  assert.match(canvas[1], /#d9d8cf/u, "캔버스 색이 달라요");
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
