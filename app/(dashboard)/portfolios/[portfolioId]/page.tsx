"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import type { PortfolioShareDto } from "@/contracts/api-contract";
import { apiClient } from "@/lib/api-client";
import { useAsyncData } from "@/hooks/useAsyncData";
import { PortfolioPreview } from "@/components/portfolio/PortfolioPreview";
import { PrintButton } from "@/components/portfolio/PrintButton";
import { LoadingState } from "@/components/ui/LoadingState";

export default function PortfolioResultPage() {
  const params = useParams<{ portfolioId: string }>();
  const router = useRouter();
  const portfolioId = String(params.portfolioId);
  const { data: portfolio, error: loadError, reload } = useAsyncData(
    () => apiClient.getPortfolio(portfolioId),
    [portfolioId],
    "포트폴리오를 불러오지 못했어요.",
  );
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  /* 공개 상태는 서버 응답이 출발점이고, 전환에 성공했을 때만 덮어쓴다.
     이펙트로 복사해두면 두 값이 어긋날 수 있다. */
  const [shareOverride, setShareOverride] = useState<PortfolioShareDto | null>(null);
  const share = shareOverride ?? portfolio?.share ?? null;
  const [sharing, setSharing] = useState(false);
  const [confirmingUnpublish, setConfirmingUnpublish] = useState(false);
  const [copied, setCopied] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (loadError) {
    return (
      <section className="page-container page-state">
        <p className="eyebrow">LOAD FAILED</p>
        <h1>{loadError}</h1>
        <div className="page-state-actions">
          <button className="button primary" type="button" onClick={reload}>다시 불러오기</button>
          <Link className="button secondary" href="/portfolios">목록으로 돌아가기</Link>
        </div>
      </section>
    );
  }

  if (!portfolio) return <LoadingState label="완성된 포트폴리오를 펼치고 있어요" />;

  const sourceLabel = portfolio.repositories.length > 1
    ? `${portfolio.repository.fullName} 외 ${portfolio.repositories.length - 1}개`
    : portfolio.repository.fullName;

  /* 실패해도 진행 표시를 반드시 되돌린다. 되돌리지 않으면 버튼이 영영
     "삭제 중…"에 머물러 사용자가 다시 시도할 수 없다. */
  const remove = async () => {
    setDeleting(true);
    setActionError(null);
    try {
      await apiClient.deletePortfolio(portfolio.id);
      router.push("/dashboard");
    } catch {
      setActionError("삭제하지 못했어요. 잠시 후 다시 시도해주세요.");
      setDeleting(false);
    }
  };

  const togglePublish = async (published: boolean) => {
    setSharing(true);
    setCopied(false);
    setActionError(null);
    try {
      setShareOverride(await apiClient.updatePortfolioShare(portfolio.id, published));
      setConfirmingUnpublish(false);
    } catch {
      setActionError("공개 설정을 바꾸지 못했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setSharing(false);
    }
  };

  // 클립보드는 보안 컨텍스트가 아니거나 권한이 없으면 그대로 실패한다.
  const copyLink = async () => {
    if (!share?.url) return;
    try {
      await navigator.clipboard.writeText(share.url);
      setCopied(true);
    } catch {
      setActionError("링크를 복사하지 못했어요. 주소를 직접 선택해 복사해주세요.");
    }
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
          <PrintButton />
          {share?.published ? (
            /* 공개 해제는 이미 보낸 링크를 전부 죽인다. 링크 복사 바로 옆에서
               한 번의 실수로 일어나면 받은 사람은 404만 보고 이유를 알 수 없다.
               삭제와 같은 2단계 확인을 둔다. */
            confirmingUnpublish ? (
              <span className="delete-confirm" role="status">
                <strong>이미 보낸 링크가 열리지 않게 돼요.</strong>
                <button
                  className="button danger"
                  type="button"
                  disabled={sharing}
                  onClick={() => togglePublish(false)}
                >
                  {sharing ? "처리 중…" : "비공개로 바꿀게요"}
                </button>
                <button
                  className="text-link"
                  type="button"
                  disabled={sharing}
                  onClick={() => setConfirmingUnpublish(false)}
                >
                  취소
                </button>
              </span>
            ) : (
              <span className="share-box" role="status">
                <em className="share-badge">공개 중</em>
                <span className="share-url" title={share.url ?? ""}>{share.url}</span>
                <button className="button secondary" type="button" onClick={copyLink}>
                  {copied ? "복사됨" : "링크 복사"}
                </button>
                <button
                  className="text-link"
                  type="button"
                  onClick={() => setConfirmingUnpublish(true)}
                >
                  비공개로
                </button>
              </span>
            )
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
      {actionError ? (
        <div className="page-container">
          <p className="inline-error" role="alert">{actionError}</p>
        </div>
      ) : null}
      <div className="page-container result-footer-actions">
        <Link className="text-link" href="/dashboard">← 대시보드로 돌아가기</Link>
        <p>인쇄 화면에서 “PDF로 저장”을 고르면 A4 이력서로 남길 수 있어요.</p>
      </div>
    </div>
  );
}
