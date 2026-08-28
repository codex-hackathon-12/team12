import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
import { PortfolioPreview } from "@/components/portfolio/PortfolioPreview";
import { getPublicPortfolio } from "@/server/portfolio/portfolios";

/**
 * 공유 링크는 채팅이나 메일에 붙였을 때 미리보기가 떠야 의미가 있다.
 * 그래서 이 페이지는 서버 컴포넌트로 두고 `generateMetadata`에서 같은 데이터를 쓴다.
 * `cache`로 감싸 메타데이터와 본문이 조회를 한 번만 하게 한다.
 */
const loadPortfolio = cache(async (slug: string) => getPublicPortfolio(slug));

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const portfolio = await loadPortfolio(slug);

  if (!portfolio) {
    return { title: "포트폴리오를 찾을 수 없습니다" };
  }

  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const baseUrl = new URL(`${protocol}://${host}`);

  const name = portfolio.content.profile.displayName;
  const title = `${name} · ${portfolio.targetRole}`;
  const description = portfolio.content.profile.headline || portfolio.title;
  const url = new URL(`/p/${slug}`, baseUrl).toString();
  const image = new URL("/og.png", baseUrl).toString();

  return {
    metadataBase: baseUrl,
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "profile", title, description, url, images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function PublicPortfolioPage({ params }: PageProps) {
  const { slug } = await params;
  const portfolio = await loadPortfolio(slug);

  if (!portfolio) {
    notFound();
  }

  return (
    <main className="public-portfolio-page">
      <div className="portfolio-canvas-wrap">
        <PortfolioPreview content={portfolio.content} variant="result" />
      </div>

      <footer className="public-portfolio-footer">
        <p>GitHub 저장소로 이런 포트폴리오를 만들 수 있어요.</p>
        <Link className="button primary" href="/">
          나도 만들어보기 →
        </Link>
      </footer>
    </main>
  );
}
