"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const navigation = [
  { href: "/dashboard", label: "대시보드" },
  { href: "/repositories", label: "포트폴리오 만들기" },
  { href: "/gallery", label: "갤러리" },
  { href: "/billing", label: "크레딧" },
];

const isCurrentPath = (pathname: string, href: string) => {
  if (href === "/dashboard") return pathname === href;
  if (href === "/repositories") {
    return (
      pathname.startsWith("/repositories") ||
      pathname.startsWith("/create") ||
      pathname.startsWith("/portfolios")
    );
  }
  return pathname.startsWith(href);
};

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

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
          </div>
        </div>
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
            {item.label === "포트폴리오 만들기" ? "만들기" : item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
