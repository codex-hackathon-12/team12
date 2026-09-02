"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { DashboardDto } from "@/contracts/api-contract";
import { apiClient } from "@/lib/api-client";
import { stageMessage, stageValueText } from "@/lib/copy";
import { formatDay } from "@/lib/format";
import { LoadingState } from "@/components/ui/LoadingState";
import { LABEL, MOCK_NOTE } from "@/lib/copy";
import { dismissNotice, useDismissedNotice } from "@/lib/dismissed-notice";


export default function DashboardPage() {
  const router = useRouter();
  const [dashboard, setDashboard] = useState<DashboardDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  /* 실패했을 때 window.location.reload()로 화면을 통째로 다시 열고 있었다.
     스크롤도 다른 화면의 입력도 함께 날아간다. 실패한 요청만 다시 보낸다. */
  const [reloadToken, setReloadToken] = useState(0);
  const dismissed = useDismissedNotice();

  useEffect(() => {
    apiClient
      .getDashboard()
      .then((response) => {
        if (!response.session.authenticated) {
          router.replace("/");
          return;
        }
        setDashboard(response);
      })
      .catch(() => setError("대시보드 정보를 불러오지 못했어요."));
  }, [router, reloadToken]);

  if (error) {
    return (
      <section className="page-container page-state">
        <p className="eyebrow">DASHBOARD</p>
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

  if (!dashboard) return <LoadingState label="대시보드를 불러오고 있어요" />;

  /* 이미 본 안내는 치울 수 있어야 한다. 서버가 24시간 뒤에 내려주지만,
     그때까지 같은 자리를 차지한다. */
  const active =
    dashboard.activeGeneration && dashboard.activeGeneration.jobId !== dismissed
      ? dashboard.activeGeneration
      : null;

  return (
    <div className="page-container dashboard-page authenticated-dashboard">
        {/* 이 화면들은 시각적 제목이 없는 디자인이다. 화면에서는 내비게이션이
            강조돼 지금 어디인지 알 수 있지만, 낭독기에는 그 단서가 없다.
            제목 하나로 이동하는 사용자에게 화면 이름을 준다(SC 2.4.6).
            내비게이션 라벨과 같은 말을 써야 눌러서 온 링크와 이어진다. */}
        <h1 className="sr-only">{LABEL.dashboard}</h1>
      {/* 진행 화면이 "대시보드에서 확인해주세요"라고 안내하는데 정작 여기에
          진행 중인 작업을 보여주는 곳이 없었다. 실패한 작업도 함께 보여준다 —
          화면을 떠난 사이에 실패하면 흔적도 없이 사라졌다. */}
      {active ? (
        /* 실패한 작업이 진행 중과 같은 라임 배경이었다. 멈춘 일이 진행처럼
           보이면 색이 상태를 거꾸로 말한다. */
        <section
          className={active.status === "failed" ? "active-generation stopped" : "active-generation"}
          aria-label={active.status === "failed" ? "멈춘 생성" : "진행 중인 생성"}
        >
          <div>
            <p className="eyebrow">
              {active.status === "failed" ? "GENERATION STOPPED" : "IN PROGRESS"}
            </p>
            <strong>
              {active.status === "failed"
                ? (active.error?.message ?? "만들다가 멈췄어요.")
                : stageMessage(active)}
            </strong>
            {active.status === "failed" ? null : (
              <span>{stageValueText(active)}</span>
            )}
          </div>
          <div className="active-generation-actions">
            <Link className="button secondary" href={`/create/${active.jobId}/processing`}>
              {active.status === "failed" ? "다시 시도하기" : "진행 상황 보기"}
            </Link>
            {/* 진행 중인 작업은 지금 벌어지는 일이라 닫을 대상이 아니다.
                멈춘 작업만 치운다. 카드가 사라지면 포커스가 body로 떨어지므로
                본문으로 옮긴다 — 키보드 사용자가 처음부터 훑지 않게. */}
            {active.status === "failed" ? (
              <button
                className="notice-dismiss"
                type="button"
                aria-label="멈춘 생성 안내 닫기"
                onClick={() => {
                  dismissNotice(active.jobId);
                  document.getElementById("main-content")?.focus({ preventScroll: true });
                }}
              >
                <span aria-hidden="true">✕</span>
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="dashboard-section dashboard-main-section split-section">
        <div>
          <div className="section-title-row compact-title">
            <div>
              <p className="eyebrow">RECENT WORK</p>
              <h2>이어서 다듬기</h2>
            </div>
            <div className="section-title-links">
              <Link className="text-link" href="/portfolios">{LABEL.portfolios} →</Link>
              <Link className="text-link" href="/repositories">{LABEL.create} →</Link>
            </div>
          </div>
          {/* 처음 온 사람의 첫 화면이 제목 두 개 아래 아무것도 없는 상태였다. */}
          {dashboard.recentPortfolios.length === 0 ? (
            <div className="empty-state">
              <span>NO PORTFOLIO</span>
              <h2>아직 만든 포트폴리오가 없어요.</h2>
              <p>GitHub 저장소를 고르면 첫 포트폴리오를 만들어드려요.</p>
              <Link className="button primary" href="/repositories">
                {LABEL.create}
              </Link>
            </div>
          ) : null}

          <div className="recent-list">
            {dashboard.recentPortfolios.map((portfolio, index) => (
              <Link
                className="recent-item"
                href={`/portfolios/${portfolio.id}`}
                key={portfolio.id}
              >
                <span className="recent-number">0{index + 1}</span>
                <div>
                  <strong>{portfolio.title}</strong>
                  <span>{portfolio.repositoryName} · {portfolio.targetRole}</span>
                </div>
                <span aria-hidden="true">↗</span>
              </Link>
            ))}
          </div>
        </div>

        <aside className="notice-panel">
          <div className="section-title-row compact-title">
            <div>
              <p className="eyebrow">NOTICE & EVENT</p>
              <h2>새로운 소식</h2>
            </div>
          </div>
          {dashboard.announcements.length === 0 ? (
            <p className="notice-empty">아직 전할 소식이 없어요.</p>
          ) : null}

          <div className="notice-list">
            {dashboard.announcements.map((announcement) => (
              <Link
                className="notice-item"
                href={`/announcements/${announcement.id}`}
                key={announcement.id}
              >
                <div>
                  <span className={`notice-type ${announcement.type}`}>
                    {announcement.type === "event" ? "EVENT" : "NOTICE"}
                  </span>
                  <time>{formatDay(announcement.publishedAt)}</time>
                </div>
                <strong>{announcement.title}</strong>
                <p>{announcement.summary}</p>
              </Link>
            ))}
          </div>
        </aside>
      </section>

      <section className="dashboard-strip" aria-label="서비스 현황">
        <div>
          <span>사용 가능 크레딧</span>
          <strong>{dashboard.credits.balance}</strong>
        </div>
        <div>
          <span>저장소 1개 예상 비용</span>
          <strong>{dashboard.credits.costPerRepository}</strong>
        </div>
        <div>
          <span>최근 포트폴리오</span>
          <strong>{dashboard.recentPortfolios.length}</strong>
        </div>
        <p>{MOCK_NOTE}</p>
      </section>
    </div>
  );
}
