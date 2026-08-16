"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { DashboardDto } from "@/contracts/api-contract";
import { apiClient } from "@/lib/api-client";
import { LoadingState } from "@/components/ui/LoadingState";

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .getDashboard()
      .then(setDashboard)
      .catch(() => setError("대시보드 정보를 불러오지 못했어요."));
  }, []);

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

  const loginUrl = apiClient.getGitHubLoginUrl("/repositories");

  return (
    <div className="page-container dashboard-page">
      <section className="dashboard-hero">
        <div className="hero-copy">
          <p className="eyebrow">GITHUB TO CAREER STORY</p>
          <h1>
            내 코드가,
            <br />
            <span>가장 설득력 있는 소개</span>가 되도록.
          </h1>
          <p className="hero-description">
            저장소 속 선택과 성과를 읽고, 지원 직무에 맞는 포트폴리오로
            정리해드려요. 복잡한 편집 없이 프롬프트 하나면 충분합니다.
          </p>
          <div className="hero-actions">
            <Link className="button primary large" href={loginUrl}>
              <span className="github-glyph" aria-hidden="true">GH</span>
              GitHub로 시작하기
            </Link>
            <Link className="text-link" href="/gallery">
              결과물 먼저 보기 <span aria-hidden="true">→</span>
            </Link>
          </div>
          <div className="hero-proof">
            <span>✓ 회원가입 없이 GitHub로 로그인</span>
            <span>✓ MVP 기간 실제 결제 없음</span>
          </div>
        </div>

        <div className="hero-product" aria-label="포트폴리오 생성 과정 미리보기">
          <div className="signal-card signal-main">
            <div className="signal-card-header">
              <span className="signal-dot" />
              <span>Repository signal</span>
              <span className="signal-score">92</span>
            </div>
            <p className="signal-label">frontend-builder / folio-maker</p>
            <h2>“계약 중심으로 팀의 병렬 개발을 설계했어요.”</h2>
            <div className="signal-bars">
              <span style={{ width: "86%" }} />
              <span style={{ width: "64%" }} />
              <span style={{ width: "76%" }} />
            </div>
          </div>
          <div className="floating-note note-one">
            <span>01</span>
            코드 구조 분석
          </div>
          <div className="floating-note note-two">
            <span>02</span>
            경험을 성과로 번역
          </div>
          <div className="hero-grid-mark" aria-hidden="true">AI / PORTFOLIO / 26</div>
        </div>
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

      <section className="dashboard-section taste-section">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">TASTE THE RESULT</p>
            <h2>시작하기 전에, 완성된 흐름을 먼저 보세요.</h2>
          </div>
          <Link className="text-link" href="/gallery/gallery_frontend">
            맛보기 전체 보기 →
          </Link>
        </div>
        <div className="taste-layout">
          <div className="taste-brief">
            <span className="mono-label">SAMPLE REPOSITORY</span>
            <h3>{dashboard.tasteSample.repository.fullName}</h3>
            <p>{dashboard.tasteSample.repository.description}</p>
            <div className="prompt-quote">
              <span>Prompt</span>
              “{dashboard.tasteSample.prompt}”
            </div>
          </div>
          <div className="taste-output">
            <div className="taste-output-top">
              <span>Generated story</span>
              <span>STATIC SAMPLE</span>
            </div>
            <h3>{dashboard.tasteSample.portfolioPreview.profile.headline}</h3>
            <p>{dashboard.tasteSample.portfolioPreview.introduction}</p>
            <div className="tag-row">
              {dashboard.tasteSample.portfolioPreview.skills[0].skills
                .slice(0, 4)
                .map((skill) => (
                  <span className="plain-tag" key={skill}>{skill}</span>
                ))}
            </div>
          </div>
        </div>
      </section>

      <section className="dashboard-section split-section">
        <div>
          <div className="section-title-row compact-title">
            <div>
              <p className="eyebrow">RECENT WORK</p>
              <h2>이어서 다듬기</h2>
            </div>
            <Link className="text-link" href="/repositories">새로 만들기 →</Link>
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
                  <time>{formatDate(announcement.publishedAt)}</time>
                </div>
                <strong>{announcement.title}</strong>
                <p>{announcement.summary}</p>
              </Link>
            ))}
          </div>
        </aside>
      </section>
    </div>
  );
}
