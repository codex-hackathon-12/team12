"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * A4 세로를 96dpi로 환산한 값이다. 인쇄 CSS의 `@page`와 같은 규격을 써야 한다.
 *
 * 여백은 `@page { margin: 8mm }`과 같은 값이다. 예전에는 여기만 10mm(38px)로
 * 남아 있어서, 화면은 인쇄보다 한 장에 30px씩 적게 담는다고 계산했다. 그 차이로
 * 프로젝트 두 개가 아슬아슬하게 넘쳐 한 장에 하나씩 잘렸다.
 */
const PAGE_WIDTH = 794;
const PAGE_HEIGHT = 1123;
const PAGE_MARGIN = 30;
const CONTENT_HEIGHT = PAGE_HEIGHT - PAGE_MARGIN * 2;

type Block = { key: string; node: ReactNode; kind?: "project" };

/*
 * 여기에 인쇄 엔진이 갖지 않은 규칙을 두지 않는다.
 *
 * 예전에는 둘이 있었다. "한 장에 프로젝트 2개까지"와 "남는 공간을 블록 사이로
 * 나눠 채우기"다. 훑기 좋게 만들려는 의도였지만, 인쇄 엔진에는 그런 규칙이
 * 없어서 미리보기가 지키지도 못할 약속을 하고 있었다. 실제로 표지 문구 위치가
 * 최대 254px, 한 장의 4분의 1만큼 어긋났다.
 *
 * 미리보기의 일은 보기 좋게 만드는 것이 아니라 인쇄되는 모습을 보여주는
 * 것이다. 마지막 장 아래가 비어 보인다면 실제로 그렇게 인쇄되기 때문이고,
 * 그 사실을 감추면 사용자는 인쇄해 보기 전까지 알 수 없다.
 */

/**
 * 축소 하한.
 *
 * 예전 하한은 0.3이었다. 그 값에서 본문 14px은 4px가 되어 아무도 읽을 수 없는데,
 * 화면은 "보이기는 하니까" 문제를 알리지 않았다. 읽을 수 있는 선에서 멈추고,
 * 그 아래 폭은 A4 보기 대신 읽기 보기가 받는다.
 */
const MIN_SCALE = 0.85;

type Page = { indexes: number[] };

/**
 * 인쇄 미리보기처럼 A4 낱장에 나눠 담는다.
 *
 * 인쇄 CSS가 히어로·지표·프로젝트 카드·역량 섹션에 `break-inside: avoid`를 걸어
 * 두었으므로, 인쇄 엔진도 같은 블록을 통째로 배치한다. 그래서 같은 단위로 높이를
 * 쌓으면 실제 인쇄와 거의 같은 지점에서 페이지가 넘어간다.
 *
 * 폰트와 이미지 로딩 시점에 따라 몇 px 차이가 날 수 있어, 측정은 두 요소가 준비된
 * 뒤 한 번 더 한다.
 */
export function PaginatedPortfolio({
  blocks,
  onPageCount,
}: {
  blocks: Block[];
  /** 나눠본 결과를 도구 모음이 인쇄 전 안내에 쓴다. */
  onPageCount?: (count: number) => void;
}) {
  const measureRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<Page[] | null>(null);
  const [scale, setScale] = useState(1);

  // 측정 대상은 화면 밖에 그려두고, 높이를 읽어 페이지로 묶는다.
  useLayoutEffect(() => {
    const measure = () => {
      const container = measureRef.current;
      if (!container) return;

      const heights = Array.from(container.children).map(
        (child) => (child as HTMLElement).getBoundingClientRect().height,
      );

      /* 넘칠 때만 다음 장으로 넘긴다. 인쇄 엔진이 하는 것과 같은 판단이고,
         여기에 규칙을 더하면 그만큼 인쇄와 갈라진다. */
      const grouped: number[][] = [];
      let current: number[] = [];
      let used = 0;

      heights.forEach((height, index) => {
        // 한 블록이 페이지보다 크면 어차피 나눌 수 없으므로 그대로 한 장에 둔다.
        if (current.length > 0 && used + height > CONTENT_HEIGHT) {
          grouped.push(current);
          current = [];
          used = 0;
        }

        current.push(index);
        used += height;
      });

      if (current.length > 0) grouped.push(current);

      onPageCount?.(grouped.length);
      setPages(grouped.map((indexes) => ({ indexes })));
    };

    measure();

    // 웹폰트와 아바타가 늦게 뜨면 높이가 달라진다.
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    fonts?.ready.then(measure).catch(() => {});

    const images = measureRef.current?.querySelectorAll("img") ?? [];
    let pending = 0;
    images.forEach((image) => {
      if (image.complete) return;
      pending += 1;
      image.addEventListener("load", measure, { once: true });
      image.addEventListener("error", measure, { once: true });
    });
    if (pending === 0) measure();
  }, [blocks, onPageCount]);

  // 좁은 화면에서는 A4 낱장이 그대로 들어가지 않으므로 폭에 맞춰 줄인다.
  useEffect(() => {
    const fit = () => {
      const frame = frameRef.current;
      if (!frame) return;
      const available = frame.clientWidth;
      setScale(available >= PAGE_WIDTH ? 1 : Math.max(available / PAGE_WIDTH, MIN_SCALE));
    };

    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  return (
    <div className="portfolio-pages" ref={frameRef}>
      {/* 측정 전용. 실제 낱장과 같은 클래스를 써야 한다.
          `.result-portfolio-preview`가 문서 토큰과 컨테이너 쿼리 기준을 갖고 있어,
          이 래퍼가 없으면 여백과 반응형이 달라져 높이가 어긋난다. */}
      <div
        className="portfolio-pages-measure portfolio-page-inner portfolio-preview result-portfolio-preview result-paper"
        aria-hidden={pages !== null}
        ref={measureRef}
      >
        {/* 실제 낱장과 같은 래퍼를 써야 한다. 래퍼가 다르면 마진 상쇄가 달라져
            측정 높이가 어긋나고 페이지가 넘친다. */}
        {blocks.map((block) => <div key={block.key}>{block.node}</div>)}
      </div>

      {pages && (
        <div
          className="portfolio-pages-stack"
          style={{
            transform: scale === 1 ? undefined : `scale(${scale})`,
            height: scale === 1 ? undefined : `${pages.length * (PAGE_HEIGHT + 24) * scale}px`,
          }}
        >
          {pages.map((page, pageIndex) => (
            <article className="portfolio-page" key={`page-${pageIndex}`}>
              <div className="portfolio-page-inner portfolio-preview result-portfolio-preview result-paper">
                {page.indexes.map((index) => (
                  <div key={blocks[index].key}>{blocks[index].node}</div>
                ))}
              </div>
              <span className="portfolio-page-number" aria-hidden="true">
                {pageIndex + 1} / {pages.length}
              </span>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
