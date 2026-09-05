"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { PortfolioPreview } from "@/components/portfolio/PortfolioPreview";
import type { PortfolioContentDto, PortfolioProjectDto } from "@/contracts/api-contract";
import type { ReactNode } from "react";
import { documentSummary } from "@/lib/copy";

/**
 * 완성된 포트폴리오를 보여주는 하나의 자리.
 *
 * 결과 화면·공개 링크·갤러리가 각자 조금씩 다르게 문서를 그리고 있었다. 갤러리만
 * 다른 형식이라, 예시를 보고 기대한 것과 실제로 받는 것이 달랐다. 보기 방식과
 * 인쇄는 문서에 딸린 성질이므로 문서와 같은 곳에서 결정한다.
 */

/**
 * A4 낱장을 읽을 수 있는 크기로 담을 수 있는 최소 폭.
 *
 * 이보다 좁으면 낱장이 화면 폭에 맞춰 계속 줄어들어, 규격은 지키지만 아무도 읽을
 * 수 없는 문서가 된다. 축소 하한을 올리는 것만으로는 부족하다 — 하한에 걸리면
 * 이번에는 옆으로 넘친다. 그 아래 폭에서는 A4 보기를 아예 열지 않고 읽기 보기가
 * 받는다. 인쇄는 어느 보기에서든 A4로 나가므로 잃는 것이 없다.
 */
const A4_MIN_WIDTH = 900;

const QUERY = `(min-width: ${A4_MIN_WIDTH}px)`;

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const getSnapshot = () => window.matchMedia(QUERY).matches;

/* 서버는 화면 폭을 모른다. A4로 그렸다가 좁은 화면에서 읽기 보기로 바뀌면
   첫 화면이 번쩍이므로, 모를 때는 읽기 보기에서 시작한다. */
const getServerSnapshot = () => false;

export function PortfolioDocument({
  content,
  printClassName = "button primary",
  renderProjectSlot,
  hasOpenQuestions = false,
}: {
  content: PortfolioContentDto;
  /** 공개 페이지는 다른 버튼 위계를 쓴다. */
  printClassName?: string;
  /**
   * 프로젝트 카드 안에 끼울 화면 전용 요소. 결과 화면만 넘긴다.
   *
   * A4 보기에는 넘기지 않는다. 그 보기는 실제 인쇄 배치를 재는 미리보기라,
   * 화면에만 있는 요소가 끼면 페이지가 넘어가는 지점이 실제와 어긋난다.
   */
  renderProjectSlot?: (project: PortfolioProjectDto) => ReactNode;
  /** 아직 답하지 않은 되묻기가 있는지. 있으면 읽기 보기로 시작한다. */
  hasOpenQuestions?: boolean;
}) {
  const wideEnough = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  /* 답할 것이 남아 있으면 손볼 수 있는 보기에서 시작한다. 두 보기의 역할이
     이걸로 오히려 또렷해진다 — 읽기 보기는 손보는 곳, A4 보기는 인쇄 확인. */
  const [prefersPaged, setPrefersPaged] = useState(!hasOpenQuestions);
  const paginated = wideEnough && prefersPaged;

  /* 장수는 실제로 나눠본 결과다. 읽기 보기에서는 나누지 않으므로 알 수 없고,
     모르는 값을 지어내는 대신 규격만 밝힌다. */
  const [pageCount, setPageCount] = useState<number | null>(null);
  const handlePageCount = useCallback((count: number) => setPageCount(count), []);

  return (
    <div className="portfolio-document">
      <div className="document-toolbar">
        {wideEnough ? (
          /* 하나만 고르는 묶음이라 진짜 라디오로 둔다. 화살표 이동과 상태 전달이
             따라오고, 결제 화면의 상품 선택과 같은 방식이라 배울 것도 없다. */
          <fieldset className="view-switch">
            <legend className="sr-only">보기 방식</legend>
            {[
              { paged: true, label: "A4 보기", hint: "인쇄되는 그대로" },
              { paged: false, label: "읽기 보기", hint: "끊김 없이 이어서" },
            ].map((option) => (
              <label className="view-switch-option" key={option.label}>
                <input
                  type="radio"
                  name="portfolio-view"
                  className="sr-only"
                  checked={prefersPaged === option.paged}
                  onChange={() => setPrefersPaged(option.paged)}
                />
                <strong>{option.label}</strong>
                <span>{option.hint}</span>
              </label>
            ))}
          </fieldset>
        ) : (
          <p className="document-note">
            화면이 좁아 이어서 보여드려요. 인쇄하면 A4 세로로 나와요.
          </p>
        )}

        <div className="document-print">
          <button className={printClassName} type="button" onClick={() => window.print()}>
            인쇄 · PDF로 저장
          </button>
          {/* 대화상자를 연 뒤에 분량을 아는 건 늦다. 버튼 옆에서 미리 말한다. */}
          <p className="document-summary">{documentSummary(content, paginated ? pageCount : null)}</p>
        </div>
      </div>

      {/* A4 보기에서 되묻기가 안 보이면 막다른 길이 된다. 어디로 가야 하는지
          한 줄로 알린다. */}
      {paginated && hasOpenQuestions ? (
        <p className="document-note document-pending" role="status">
          아직 답하지 않은 질문이 있어요. 읽기 보기에서 채울 수 있어요.
        </p>
      ) : null}

      <div className="portfolio-canvas-wrap">
        <PortfolioPreview
          content={content}
          paginated={paginated}
          onPageCount={handlePageCount}
          renderProjectSlot={paginated ? undefined : renderProjectSlot}
        />
      </div>
    </div>
  );
}
