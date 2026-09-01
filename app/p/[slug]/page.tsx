import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
import { PortfolioPreview } from "@/components/portfolio/PortfolioPreview";
import { PrintButton } from "@/components/portfolio/PrintButton";
import { getRequestOrigin, resolvePublicBaseUrl } from "@/server/http";
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

  /* 링크를 만들 때와 같은 정식 주소를 써야 canonical과 og:url이 공유된 주소와
     어긋나지 않는다. */
  const requestHeaders = await headers();
  const baseUrl = new URL(resolvePublicBaseUrl(getRequestOrigin(requestHeaders)));

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
      {/* 받은 사람이 바로 종이나 PDF로 챙겨갈 수 있게 한다. 인쇄에는 나오지 않는다. */}
      <div className="public-portfolio-toolbar">
        <div>
          <p className="eyebrow">SHARED PORTFOLIO</p>
          <strong>{portfolio.content.profile.displayName}</strong>
        </div>
        <PrintButton className="button secondary" />
      </div>

      <div className="portfolio-canvas-wrap">
        <PortfolioPreview content={portfolio.content} variant="result" paginated />
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
