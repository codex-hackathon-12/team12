"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { PortfolioDto, PortfolioShareDto } from "@/contracts/api-contract";
import { apiClient } from "@/lib/api-client";
import { PortfolioPreview } from "@/components/portfolio/PortfolioPreview";
import { LoadingState } from "@/components/ui/LoadingState";

export default function PortfolioResultPage() {
  const params = useParams<{ portfolioId: string }>();
  const router = useRouter();
  const [portfolio, setPortfolio] = useState<PortfolioDto | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [share, setShare] = useState<PortfolioShareDto | null>(null);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    apiClient.getPortfolio(String(params.portfolioId)).then((response) => {
      setPortfolio(response);
      setShare(response.share);
    });
  }, [params.portfolioId]);

  if (!portfolio) return <LoadingState label="완성된 포트폴리오를 펼치고 있어요" />;

  const sourceLabel = portfolio.repositories.length > 1
    ? `${portfolio.repository.fullName} 외 ${portfolio.repositories.length - 1}개`
    : portfolio.repository.fullName;

  const remove = async () => {
    setDeleting(true);
    await apiClient.deletePortfolio(portfolio.id);
    router.push("/dashboard");
  };

  const togglePublish = async (published: boolean) => {
    setSharing(true);
    setCopied(false);
    setShare(await apiClient.updatePortfolioShare(portfolio.id, published));
    setSharing(false);
  };

  const copyLink = async () => {
    if (!share?.url) return;
    await navigator.clipboard.writeText(share.url);
    setCopied(true);
  };

  return (
    <div className="result-page">
      <div className="page-container result-toolbar">
        <div>
          <span className="success-check" aria-hidden="true">✓</span>
          <div>
            <p>생성이 완료됐어요</p>
            <strong>{sourceLabel}</strong>
          </div>
        </div>
        <div className="result-actions">
          <Link className="button secondary" href="/repositories">다시 만들기</Link>
          {/* PDF는 브라우저 인쇄의 "PDF로 저장"으로 만든다. 문서가 A4 세로 규격이라
              인쇄 대화상자에서 바로 규격에 맞는 파일이 나온다. */}
          <button className="button primary" type="button" onClick={() => window.print()}>
            인쇄 · PDF로 저장
          </button>
          {share?.published ? (
            <span className="share-box" role="status">
              <span className="share-url" title={share.url ?? ""}>{share.url}</span>
              <button className="button secondary" type="button" onClick={copyLink}>
                {copied ? "복사됨" : "링크 복사"}
              </button>
              <button
                className="text-link"
                type="button"
                disabled={sharing}
                onClick={() => togglePublish(false)}
              >
                {sharing ? "처리 중…" : "비공개로"}
              </button>
            </span>
          ) : (
            <button
              className="button secondary"
              type="button"
              disabled={sharing}
              onClick={() => togglePublish(true)}
            >
              {sharing ? "공개하는 중…" : "공개 링크 만들기"}
            </button>
          )}

          {confirmingDelete ? (
            <span className="delete-confirm" role="status">
              <strong>되돌릴 수 없어요.</strong>
              <button
                className="button danger"
                type="button"
                disabled={deleting}
                onClick={remove}
              >
                {deleting ? "삭제 중…" : "삭제할게요"}
              </button>
              <button
                className="text-link"
                type="button"
                disabled={deleting}
                onClick={() => setConfirmingDelete(false)}
              >
                취소
              </button>
            </span>
          ) : (
            <button
              className="button secondary"
              type="button"
              onClick={() => setConfirmingDelete(true)}
            >
              삭제
            </button>
          )}
        </div>
      </div>
      <div className="portfolio-canvas-wrap">
        <PortfolioPreview content={portfolio.content} variant="result" paginated />
      </div>
      <div className="page-container result-footer-actions">
        <Link className="text-link" href="/dashboard">← 대시보드로 돌아가기</Link>
        <p>PDF 이력서는 로그인한 소유자만 내려받을 수 있습니다.</p>
      </div>
    </div>
  );
}
