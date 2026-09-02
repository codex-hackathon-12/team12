"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PortfolioSummaryDto } from "@/contracts/api-contract";
import { apiClient } from "@/lib/api-client";
import { formatDay } from "@/lib/format";
import { useReturnFocus } from "@/hooks/useReturnFocus";
import { LoadingState } from "@/components/ui/LoadingState";
import { LABEL } from "@/lib/copy";
import { SteadyLabel } from "@/components/ui/SteadyLabel";


export default function PortfolioListPage() {
  const [portfolios, setPortfolios] = useState<PortfolioSummaryDto[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /* 로드 실패의 복구는 실패한 요청만 다시 보내는 것으로 통일한다. */
  const [reloadToken, setReloadToken] = useState(0);

  // 삭제는 되돌릴 수 없어 카드 자리에서 한 번 더 확인받는다.
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .getPortfolios()
      .then((response) => {
        setPortfolios(response.portfolios);
        setNextCursor(response.hasNextPage ? response.nextCursor : null);
      })
      .catch(() => setError("포트폴리오 목록을 불러오지 못했어요."));
  }, [reloadToken]);

  /* 실패해도 진행 표시를 반드시 되돌린다. 되돌리지 않으면 버튼이 "불러오는 중…"
     상태로 영영 잠겨 새로고침 말고는 방법이 없다. 상세 화면은 이미 이렇게 한다. */
  const loadMore = async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    setActionError(null);
    try {
      const response = await apiClient.getPortfolios({ cursor: nextCursor });
      setPortfolios((current) => [...(current ?? []), ...response.portfolios]);
      setNextCursor(response.hasNextPage ? response.nextCursor : null);
    } catch {
      setActionError("더 불러오지 못했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoadingMore(false);
    }
  };

  const remove = async (portfolioId: string) => {
    setDeletingId(portfolioId);
    setActionError(null);
    try {
      await apiClient.deletePortfolio(portfolioId);
      setPortfolios((current) =>
        (current ?? []).filter((portfolio) => portfolio.id !== portfolioId),
      );
      setConfirmingId(null);
    } catch {
      setActionError("삭제하지 못했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setDeletingId(null);
    }
  };

  if (error) {
    return (
      <section className="page-container page-state">
        <p className="eyebrow">MY PORTFOLIOS</p>
        <h1>{error}</h1>
        <button
          className="button primary"
          type="button"
          onClick={() => {
            setError(null);
            setReloadToken((value) => value + 1);
          }}
        >
          다시 불러오기
        </button>
      </section>
    );
  }

  return (
    <div className="page-container portfolio-list-page">
      <header className="section-title-row">
        <div>
          <p className="eyebrow">MY PORTFOLIOS</p>
          <h1>내가 만든 포트폴리오</h1>
        </div>
        <Link className="text-link" href="/repositories">{LABEL.create} →</Link>
      </header>

      {!portfolios ? (
        <LoadingState label="포트폴리오를 불러오고 있어요" />
      ) : portfolios.length === 0 ? (
        <div className="empty-state">
          <div>
            <span className="eyebrow">NO PORTFOLIO</span>
            <h2>아직 만든 포트폴리오가 없어요.</h2>
            <Link className="button primary" href="/repositories">{LABEL.create} →</Link>
          </div>
        </div>
      ) : (
        <>
          <div className="portfolio-list-grid">
            {portfolios.map((portfolio) => (
              <article className="portfolio-list-card" key={portfolio.id}>
                <Link className="portfolio-list-main" href={`/portfolios/${portfolio.id}`}>
                  <p className="portfolio-list-meta">
                    <span>{portfolio.targetRole}</span>
                    <span>
                      {portfolio.share.published && <em className="share-badge">공개 중</em>}
                      {formatDay(portfolio.createdAt)}
                    </span>
                  </p>
                  <h2>{portfolio.title}</h2>
                  <p className="portfolio-list-source">
                    {portfolio.repositoryName}
                    {portfolio.repositoryCount > 1 && (
                      <em> 외 {portfolio.repositoryCount - 1}개</em>
                    )}
                  </p>
                </Link>

                {portfolio.techStack.length > 0 && (
                  <div className="tag-row">
                    {portfolio.techStack.slice(0, 6).map((tech) => (
                      <span className="plain-tag" key={tech}>{tech}</span>
                    ))}
                  </div>
                )}

                <div className="portfolio-list-actions">
                  <Link className="text-link" href={`/portfolios/${portfolio.id}`}>열기 ↗</Link>
                  <DeleteAction
                    confirming={confirmingId === portfolio.id}
                    deleting={deletingId === portfolio.id}
                    onAsk={() => setConfirmingId(portfolio.id)}
                    onCancel={() => setConfirmingId(null)}
                    onConfirm={() => remove(portfolio.id)}
                  />
                </div>
              </article>
            ))}
          </div>

          {actionError ? (
            <p className="inline-error" role="alert">{actionError}</p>
          ) : null}

          {nextCursor && (
            <div className="portfolio-list-more">
              <button
                className="button secondary"
                type="button"
                disabled={loadingMore}
                onClick={loadMore}
              >
                <SteadyLabel
                  states={["더 보기", "불러오는 중…"]}
                  value={loadingMore ? "불러오는 중…" : "더 보기"}
                />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * 카드 하나의 삭제 동작.
 *
 * 확인 줄이 열리면 눌렀던 버튼이 사라져 포커스가 body로 떨어졌다. 카드마다
 * 독립된 복귀 지점이 필요해서 컴포넌트로 나눈다.
 */
function DeleteAction({
  confirming,
  deleting,
  onAsk,
  onCancel,
  onConfirm,
}: {
  confirming: boolean;
  deleting: boolean;
  onAsk: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { triggerRef, confirmRef, cancelReturn } = useReturnFocus(confirming);

  if (!confirming) {
    return (
      <button className="text-link danger-link" type="button" ref={triggerRef} onClick={onAsk}>
        삭제
      </button>
    );
  }

  return (
    <span className="delete-confirm" role="status">
      <strong>되돌릴 수 없어요.</strong>
      <button
        className="button danger"
        type="button"
        ref={confirmRef}
        aria-disabled={deleting}
        onClick={() => {
          // aria-disabled는 클릭을 막지 않는다. 중복 실행은 여기서 막는다.
          if (deleting) return;
          // 삭제에 성공하면 카드가 사라진다. 돌아갈 자리가 없다.
          cancelReturn();
          onConfirm();
        }}
      >
        <SteadyLabel
          states={["삭제할게요", "삭제 중…"]}
          value={deleting ? "삭제 중…" : "삭제할게요"}
        />
      </button>
      <button
        className="text-link"
        type="button"
        aria-disabled={deleting}
        onClick={() => {
          if (deleting) return;
          onCancel();
        }}
      >
        취소
      </button>
    </span>
  );
}
