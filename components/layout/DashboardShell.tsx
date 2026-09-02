"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { GitHubUserDto } from "@/contracts/api-contract";
import { apiClient } from "@/lib/api-client";
import { LABEL, SHORT_LABEL } from "@/lib/copy";

// 항목 수를 바꾸면 app/globals.css의 .mobile-nav 열 수도 함께 바꿔야 한다.
const navigation = [
  { href: "/dashboard", key: "dashboard" },
  { href: "/portfolios", key: "portfolios" },
  { href: "/repositories", key: "create" },
  { href: "/gallery", key: "gallery" },
  { href: "/billing", key: "billing" },
] as const;

const isCurrentPath = (pathname: string, href: string) => {
  if (href === "/dashboard") return pathname === href;
  if (href === "/repositories") {
    return pathname.startsWith("/repositories") || pathname.startsWith("/create");
  }
  return pathname.startsWith(href);
};

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutFailed, setLogoutFailed] = useState(false);
  const [user, setUser] = useState<GitHubUserDto | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  const isFirstRender = useRef(true);

  /* 화면을 옮겨도 포커스가 그대로 남아 있었다. 브라우저가 그것을 body로 되돌리기
     때문에, 키보드 사용자는 링크를 누를 때마다 헤더의 아홉 개 탭 스톱을 처음부터
     다시 지나야 했다. 화면 낭독기도 화면이 바뀐 사실을 듣지 못했다.
     본문으로 포커스를 옮기면 둘 다 해결된다. 첫 렌더에서는 옮기지 않는다 —
     사용자가 방금 도착한 곳이라 빼앗을 포커스가 없다. */
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    mainRef.current?.focus({ preventScroll: true });
  }, [pathname]);

  /* 헤더는 레이아웃 안에 있어 화면을 옮겨도 다시 마운트되지 않는다.
     그래서 한 번만 읽는다. 읽지 못하면 숫자나 이름을 지어내지 않고 감춘다. */
  useEffect(() => {
    let active = true;
    apiClient
      .getSession()
      .then((session) => {
        if (active) setUser(session.user);
      })
      .catch(() => {
        if (active) setUser(null);
      });
    return () => {
      active = false;
    };
  }, []);

  /* 세션 쿠키가 살아있는 채로 랜딩에 보내면 곧장 대시보드로 되돌아온다.
     그래서 로그아웃이 성공했을 때만 이동한다. */
  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    setLogoutFailed(false);
    try {
      await apiClient.logout();
      router.replace("/");
      router.refresh();
    } catch {
      setLogoutFailed(true);
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="app-shell">
      {/* 헤더에 탭 스톱이 아홉 개라 매 화면마다 그것을 지나야 했다. */}
      <a className="sr-only sr-only-focusable skip-link" href="#main-content">
        본문으로 건너뛰기
      </a>
      <header className="site-header">
        <div className="header-inner">
          <Link className="brand" href="/dashboard" aria-label="포트폴리오 AI 홈">
            <span className="brand-mark" aria-hidden="true">
              F/
            </span>
            <span>folio.ai</span>
            <span className="brand-beta">beta</span>
          </Link>

          <nav className="desktop-nav" aria-label="주요 메뉴">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={
                  isCurrentPath(pathname, item.href) ? "nav-link active" : "nav-link"
                }
              >
                {LABEL[item.key]}
              </Link>
            ))}
          </nav>

          <div className="header-actions">
            {user ? (
              <Link className="credit-indicator" href="/billing">
                <span aria-hidden="true">●</span>
                {user.creditBalance} 크레딧
                <span className="mock-chip">체험</span>
              </Link>
            ) : null}
            <Link
              className={pathname.startsWith("/settings") ? "avatar-button active" : "avatar-button"}
              href="/settings"
              aria-label={user ? `${user.displayName} ${LABEL.settings}` : LABEL.settings}
            >
              {user ? [...user.displayName][0] : ""}
            </Link>
            <button
              className="logout-button"
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? "로그아웃 중…" : "로그아웃"}
            </button>
          </div>
        </div>
        {logoutFailed ? (
          <p className="logout-error" role="alert">
            로그아웃하지 못했어요. 잠시 후 다시 시도해주세요.
          </p>
        ) : null}
      </header>

      <main className="site-main" id="main-content" tabIndex={-1} ref={mainRef}>
        {children}
      </main>

      <nav className="mobile-nav" aria-label="모바일 주요 메뉴">
        {navigation.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={
              isCurrentPath(pathname, item.href)
                ? "mobile-nav-link active"
                : "mobile-nav-link"
            }
          >
            <span className="mobile-nav-dot" aria-hidden="true" />
            {SHORT_LABEL[item.key] ?? LABEL[item.key]}
          </Link>
        ))}
      </nav>
    </div>
  );
}
