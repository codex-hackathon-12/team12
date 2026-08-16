"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { TasteSampleDto } from "@/contracts/api-contract";
import { LoadingState } from "@/components/ui/LoadingState";
import { apiClient } from "@/lib/api-client";

export default function Home() {
  const router = useRouter();
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [tasteSample, setTasteSample] = useState<TasteSampleDto | null>(null);

  useEffect(() => {
    let active = true;
    const isLocalLandingPreview =
      ["localhost", "127.0.0.1"].includes(window.location.hostname) &&
      new URLSearchParams(window.location.search).get("preview") === "landing";

    if (isLocalLandingPreview) {
      Promise.resolve().then(() => {
        if (active) setIsAnonymous(true);
      });
    } else {
      apiClient
        .getSession()
        .then((session) => {
          if (!active) return;
          if (session.authenticated) {
            router.replace("/dashboard");
            return;
          }
          setIsAnonymous(true);
        })
        .catch(() => {
          if (active) setIsAnonymous(true);
        });
    }

    apiClient
      .getTasteSample()
      .then((sample) => {
        if (active) setTasteSample(sample);
      })
      .catch(() => {
        if (active) setTasteSample(null);
      });

    return () => {
      active = false;
    };
  }, [router]);

  if (!isAnonymous) {
    return <LoadingState label="로그인 상태를 확인하고 있어요" />;
  }

  const loginHref = apiClient.getGitHubLoginUrl("/dashboard");

  return (
    <main className="landing-page">
      <header className="landing-header page-container">
        <Link className="brand" href="/" aria-label="folio.ai 랜딩 홈">
          <span className="brand-mark" aria-hidden="true">F/</span>
          <span>folio.ai</span>
          <span className="brand-beta">beta</span>
        </Link>
        <nav aria-label="랜딩 메뉴">
          <Link className="text-link" href="/gallery">갤러리</Link>
          <Link className="button secondary" href={loginHref}>
            GitHub 로그인
          </Link>
        </nav>
      </header>

      <section className="dashboard-hero landing-hero page-container">
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
            <Link className="button primary large" href={loginHref}>
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
          <div className="floating-note note-one"><span>01</span>코드 구조 분석</div>
          <div className="floating-note note-two"><span>02</span>경험을 성과로 번역</div>
          <div className="hero-grid-mark" aria-hidden="true">AI / PORTFOLIO / 26</div>
        </div>
      </section>

      <section className="dashboard-section taste-section landing-taste page-container">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">TASTE THE RESULT</p>
            <h2>시작하기 전에, 완성된 흐름을 먼저 보세요.</h2>
          </div>
          <Link className="text-link" href="/gallery/gallery_frontend">
            맛보기 전체 보기 →
          </Link>
        </div>
        {tasteSample ? (
          <div className="taste-layout">
            <div className="taste-brief">
              <span className="mono-label">SAMPLE REPOSITORY</span>
              <h3>{tasteSample.repository.fullName}</h3>
              <p>{tasteSample.repository.description}</p>
              <div className="prompt-quote">
                <span>Prompt</span>
                “{tasteSample.prompt}”
              </div>
            </div>
            <div className="taste-output">
              <div className="taste-output-top">
                <span>Generated story</span>
                <span>STATIC SAMPLE</span>
              </div>
              <h3>{tasteSample.portfolioPreview.profile.headline}</h3>
              <p>{tasteSample.portfolioPreview.introduction}</p>
              <div className="tag-row">
                {tasteSample.portfolioPreview.skills[0].skills.slice(0, 4).map((skill) => (
                  <span className="plain-tag" key={skill}>{skill}</span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="landing-sample-loading" aria-live="polite">
            완성된 포트폴리오 예시를 준비하고 있어요.
          </div>
        )}
      </section>

      <footer className="landing-footer page-container">
        <span>folio.ai · GitHub to career story</span>
        <Link className="text-link" href={loginHref}>지금 시작하기 →</Link>
      </footer>
    </main>
  );
}
