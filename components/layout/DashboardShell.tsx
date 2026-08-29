"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { apiClient } from "@/lib/api-client";

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
            <Link className="credit-indicator" href="/billing">
              <span aria-hidden="true">●</span>
              100 크레딧
            </Link>
            <button className="avatar-button" type="button" aria-label="사용자 메뉴">
              김
            </button>
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
