"use client";

import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * A4 세로를 96dpi로 환산한 값이다. 인쇄 CSS의 `@page`와 같은 규격을 쓴다.
 * 여백 10mm를 빼면 본문이 들어갈 수 있는 높이가 나온다.
 */
const PAGE_WIDTH = 794;
const PAGE_HEIGHT = 1123;
const PAGE_MARGIN = 38;
const CONTENT_HEIGHT = PAGE_HEIGHT - PAGE_MARGIN * 2;

type Block = { key: string; node: ReactNode };

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
export function PaginatedPortfolio({ blocks }: { blocks: Block[] }) {
  const measureRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<number[][] | null>(null);
  const [scale, setScale] = useState(1);

  // 측정 대상은 화면 밖에 그려두고, 높이를 읽어 페이지로 묶는다.
  useLayoutEffect(() => {
    const measure = () => {
      const container = measureRef.current;
      if (!container) return;

      const heights = Array.from(container.children).map(
        (child) => (child as HTMLElement).getBoundingClientRect().height,
      );

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
      setPages(grouped);
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
  }, [blocks]);

  // 좁은 화면에서는 A4 낱장이 그대로 들어가지 않으므로 폭에 맞춰 줄인다.
  useEffect(() => {
    const fit = () => {
      const frame = frameRef.current;
      if (!frame) return;
      const available = frame.clientWidth;
      setScale(available >= PAGE_WIDTH ? 1 : Math.max(available / PAGE_WIDTH, 0.3));
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
        className="portfolio-pages-measure portfolio-page-inner portfolio-preview result-portfolio-preview"
        aria-hidden={pages !== null}
        ref={measureRef}
      >
        {blocks.map((block) => <Fragment key={block.key}>{block.node}</Fragment>)}
      </div>

      {pages && (
        <div
          className="portfolio-pages-stack"
          style={{
            transform: scale === 1 ? undefined : `scale(${scale})`,
            height: scale === 1 ? undefined : `${pages.length * (PAGE_HEIGHT + 24) * scale}px`,
          }}
        >
          {pages.map((indexes, pageIndex) => (
            <article className="portfolio-page" key={`page-${pageIndex}`}>
              <div className="portfolio-page-inner portfolio-preview result-portfolio-preview">
                {indexes.map((index) => (
                  <Fragment key={blocks[index].key}>{blocks[index].node}</Fragment>
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
