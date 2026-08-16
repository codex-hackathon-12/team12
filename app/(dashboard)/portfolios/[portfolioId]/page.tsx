"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { PortfolioDto } from "@/contracts/api-contract";
import { apiClient } from "@/lib/api-client";
import { PortfolioPreview } from "@/components/portfolio/PortfolioPreview";
import { LoadingState } from "@/components/ui/LoadingState";

export default function PortfolioResultPage() {
  const params = useParams<{ portfolioId: string }>();
  const [portfolio, setPortfolio] = useState<PortfolioDto | null>(null);

  useEffect(() => {
    apiClient.getPortfolio(String(params.portfolioId)).then(setPortfolio);
  }, [params.portfolioId]);

  if (!portfolio) return <LoadingState label="완성된 포트폴리오를 펼치고 있어요" />;

  return (
    <div className="result-page">
      <div className="page-container result-toolbar">
        <div>
          <span className="success-check" aria-hidden="true">✓</span>
          <div>
            <p>생성이 완료됐어요</p>
            <strong>{portfolio.repository.fullName}</strong>
          </div>
        </div>
        <div className="result-actions">
          <Link className="button secondary" href="/repositories">다시 만들기</Link>
          {portfolio.resumePdf ? (
            <a className="button primary" href={portfolio.resumePdf.downloadUrl} download>
              PDF 이력서 받기
            </a>
          ) : (
            <button className="button primary" type="button" onClick={() => window.print()}>
              인쇄 미리보기
            </button>
          )}
        </div>
      </div>
      <div className="portfolio-canvas-wrap">
        <PortfolioPreview content={portfolio.content} variant="result" />
      </div>
      <div className="page-container result-footer-actions">
        <Link className="text-link" href="/dashboard">← 대시보드로 돌아가기</Link>
        <p>PDF 이력서는 로그인한 소유자만 내려받을 수 있습니다.</p>
      </div>
    </div>
  );
}
