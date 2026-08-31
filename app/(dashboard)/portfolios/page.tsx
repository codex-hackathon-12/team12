"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PortfolioSummaryDto } from "@/contracts/api-contract";
import { apiClient } from "@/lib/api-client";
import { formatDay } from "@/lib/format";
import { LoadingState } from "@/components/ui/LoadingState";


export default function PortfolioListPage() {
  const [portfolios, setPortfolios] = useState<PortfolioSummaryDto[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 삭제는 되돌릴 수 없어 카드 자리에서 한 번 더 확인받는다.
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .getPortfolios()
      .then((response) => {
        setPortfolios(response.portfolios);
        setNextCursor(response.hasNextPage ? response.nextCursor : null);
      })
      .catch(() => setError("포트폴리오 목록을 불러오지 못했어요."));
  }, []);

  const loadMore = async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    const response = await apiClient.getPortfolios({ cursor: nextCursor });
    setPortfolios((current) => [...(current ?? []), ...response.portfolios]);
    setNextCursor(response.hasNextPage ? response.nextCursor : null);
    setLoadingMore(false);
  };

  const remove = async (portfolioId: string) => {
    setDeletingId(portfolioId);
    await apiClient.deletePortfolio(portfolioId);
    setPortfolios((current) =>
      (current ?? []).filter((portfolio) => portfolio.id !== portfolioId),
    );
    setConfirmingId(null);
    setDeletingId(null);
  };

  if (error) {
    return (
      <section className="page-container page-state">
        <p className="eyebrow">MY PORTFOLIOS</p>
        <h1>{error}</h1>
        <button className="button primary" type="button" onClick={() => window.location.reload()}>
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
        <Link className="text-link" href="/repositories">새로 만들기 →</Link>
      </header>

      {!portfolios ? (
        <LoadingState label="포트폴리오를 불러오고 있어요" />
      ) : portfolios.length === 0 ? (
        <div className="empty-state">
          <div>
            <span className="eyebrow">NO PORTFOLIO</span>
            <h2>아직 만든 포트폴리오가 없어요.</h2>
            <Link className="button primary" href="/repositories">첫 포트폴리오 만들기 →</Link>
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
                  {confirmingId === portfolio.id ? (
                    <span className="delete-confirm" role="status">
                      <strong>되돌릴 수 없어요.</strong>
                      <button
                        className="button danger"
                        type="button"
                        disabled={deletingId === portfolio.id}
                        onClick={() => remove(portfolio.id)}
                      >
                        {deletingId === portfolio.id ? "삭제 중…" : "삭제할게요"}
                      </button>
                      <button
                        className="text-link"
                        type="button"
                        disabled={deletingId === portfolio.id}
                        onClick={() => setConfirmingId(null)}
                      >
                        취소
                      </button>
                    </span>
                  ) : (
                    <button
                      className="text-link danger-link"
                      type="button"
                      onClick={() => setConfirmingId(portfolio.id)}
                    >
                      삭제
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>

          {nextCursor && (
            <div className="portfolio-list-more">
              <button
                className="button secondary"
                type="button"
                disabled={loadingMore}
                onClick={loadMore}
              >
                {loadingMore ? "불러오는 중…" : "더 보기"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
