"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { DashboardDto } from "@/contracts/api-contract";
import { apiClient } from "@/lib/api-client";
import { stageMessage, stageValueText } from "@/lib/copy";
import { formatDay } from "@/lib/format";
import { LoadingState } from "@/components/ui/LoadingState";


export default function DashboardPage() {
  const router = useRouter();
  const [dashboard, setDashboard] = useState<DashboardDto | null>(null);
  const [error, setError] = useState<string | null>(null);

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
  }, [router]);

  if (error) {
    return (
      <section className="page-container page-state">
        <p className="eyebrow">DASHBOARD</p>
        <h1>{error}</h1>
        <button className="button primary" onClick={() => window.location.reload()}>
          다시 불러오기
        </button>
      </section>
    );
  }

  if (!dashboard) return <LoadingState label="오늘의 작업 공간을 준비하고 있어요" />;

  const active = dashboard.activeGeneration;

  return (
    <div className="page-container dashboard-page authenticated-dashboard">
      {/* 진행 화면이 "대시보드에서 확인해주세요"라고 안내하는데 정작 여기에
          진행 중인 작업을 보여주는 곳이 없었다. 실패한 작업도 함께 보여준다 —
          화면을 떠난 사이에 실패하면 흔적도 없이 사라졌다. */}
      {active ? (
        <section className="active-generation" aria-label="진행 중인 생성">
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
          <Link className="button secondary" href={`/create/${active.jobId}/processing`}>
            {active.status === "failed" ? "다시 시도하기" : "진행 상황 보기"}
          </Link>
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
              <Link className="text-link" href="/portfolios">전체 보기 →</Link>
              <Link className="text-link" href="/repositories">새로 만들기 →</Link>
            </div>
          </div>
          {/* 처음 온 사람의 첫 화면이 제목 두 개 아래 아무것도 없는 상태였다. */}
          {dashboard.recentPortfolios.length === 0 ? (
            <div className="empty-state">
              <span>NO PORTFOLIO</span>
              <h2>아직 만든 포트폴리오가 없어요.</h2>
              <p>GitHub 저장소를 고르면 첫 포트폴리오를 만들어드려요.</p>
              <Link className="button primary" href="/repositories">
                첫 포트폴리오 만들기
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
        <p>현재 모든 크레딧은 체험용이며 실제로 차감되지 않아요.</p>
      </section>
    </div>
  );
}
