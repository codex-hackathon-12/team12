"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { DashboardDto } from "@/contracts/api-contract";
import { apiClient } from "@/lib/api-client";
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

  return (
    <div className="page-container dashboard-page authenticated-dashboard">
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
