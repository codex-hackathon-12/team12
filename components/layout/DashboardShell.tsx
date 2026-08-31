"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import type { GitHubUserDto } from "@/contracts/api-contract";
import { apiClient } from "@/lib/api-client";

// 항목 수를 바꾸면 app/globals.css의 .mobile-nav 열 수도 함께 바꿔야 한다.
const navigation = [
  { href: "/dashboard", label: "대시보드" },
  { href: "/portfolios", label: "내 포트폴리오" },
  { href: "/repositories", label: "포트폴리오 만들기" },
  { href: "/gallery", label: "갤러리" },
  { href: "/billing", label: "크레딧" },
];

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
                {item.label}
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
              aria-label={user ? `${user.displayName} 계정 설정` : "계정 설정"}
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

      <main className="site-main">{children}</main>

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
            {item.label === "포트폴리오 만들기"
              ? "만들기"
              : item.label === "내 포트폴리오"
                ? "내 작업"
                : item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
