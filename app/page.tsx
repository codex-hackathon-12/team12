"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { TasteSampleDto } from "@/contracts/api-contract";
import { LoadingState } from "@/components/ui/LoadingState";
import { apiClient } from "@/lib/api-client";
import { MOCK_CHIP } from "@/lib/copy";
import { REQUESTED_SCOPES } from "@/lib/scopes";
import { LABEL } from "@/lib/copy";

/* 로그인 콜백이 실패를 사유와 함께 돌려보낸다. 사유마다 사용자가 할 일이 다르다. */
const AUTH_FAILURE_MESSAGES: Record<string, string> = {
  state_expired: "로그인 창을 너무 오래 열어뒀어요. 다시 시작해주세요.",
  denied: "GitHub에서 권한 요청을 취소했어요. 저장소를 읽어야 포트폴리오를 만들 수 있어요.",
  failed: "GitHub 로그인을 마치지 못했어요. 잠시 후 다시 시도해주세요.",
};

/* useSearchParams는 정적 프리렌더를 중단시키므로 Suspense 경계가 필요하다.
   랜딩 본문 전체를 감싸 두면 나중에 다른 쿼리 파라미터를 읽어도 그대로 쓸 수 있다. */
export default function Home() {
  return (
    <Suspense fallback={<LoadingState label="화면을 불러오고 있어요" />}>
      <LandingPage />
    </Suspense>
  );
}

function LandingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const authFailure = AUTH_FAILURE_MESSAGES[searchParams.get("auth") ?? ""];
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
    return <LoadingState label="화면을 불러오고 있어요" />;
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
          <Link className="text-link" href="/gallery">{LABEL.gallery}</Link>
          <a className="button secondary" href={loginHref}>
            GitHub 로그인
          </a>
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
            정리해드려요. 복잡한 편집 없이 프롬프트 하나면 충분해요.
          </p>
          {/* 로그인이 실패한 채 돌아온 경우, 왜 그런지와 다음에 뭘 하면 되는지를
              로그인 버튼 바로 옆에서 알려준다. */}
          {authFailure ? (
            <p className="inline-error" role="alert">{authFailure}</p>
          ) : null}

          <div className="hero-actions">
            {/*
              GitHub 로그인은 앱 안의 화면 이동이 아니라 서버 라우트로 나가는
              이동이다. <Link>로 두면 Next가 이 주소를 프리페치하는데, 그 라우트는
              OAuth state 쿠키를 새로 굽고 GitHub으로 302한다. 결과적으로 화면을
              열기만 해도 state가 여러 번 덮어써지고, 사용자가 버튼을 누른 뒤
              늦게 도착한 프리페치가 쿠키를 갈아치우면 GitHub이 돌려준 state와
              어긋나 "로그인 창을 너무 오래 열어뒀어요"가 뜬다. 운영 콘솔에
              GitHub으로 나가는 CORS 실패가 찍혀 있던 것이 이 프리페치다.
            */}
            <a className="button primary large" href={loginHref}>
              <span className="github-glyph" aria-hidden="true">GH</span>
              GitHub로 시작하기
            </a>
            <Link className="text-link" href="/gallery">
              결과물 먼저 보기 <span aria-hidden="true">→</span>
            </Link>
          </div>
          <div className="hero-proof">
            <span>✓ 회원가입 없이 GitHub로 로그인</span>
            <span>✓ {MOCK_CHIP}</span>
          </div>

          {/* 어떤 권한을 왜 요구하는지 GitHub 동의 화면에 가기 전에 읽을 수 있어야
              한다. 예전에는 같은 설명이 설정 화면에만 있었고, 그건 권한을 이미 준
              뒤다. 근거: NN/g — 이유를 먼저 설명하면 승인률이 크게 오른다. */}
          <details className="scope-disclosure">
            <summary>GitHub에서 어떤 권한을 요청하나요?</summary>
            <ul>
              {REQUESTED_SCOPES.map((scope) => (
                <li key={scope.name}>
                  <strong>
                    {scope.label}
                    {scope.required ? null : <em> (선택)</em>}
                  </strong>
                  <span>{scope.description}</span>
                </li>
              ))}
            </ul>
            <p>권한은 GitHub 설정에서 언제든 거둘 수 있어요.</p>
          </details>
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
                {(tasteSample.portfolioPreview.skills[0]?.skills ?? []).slice(0, 4).map((skill) => (
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
        <a className="text-link" href={loginHref}>지금 시작하기 →</a>
      </footer>
    </main>
  );
}
