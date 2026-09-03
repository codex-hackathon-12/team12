import type { Metadata } from "next";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const baseUrl = new URL(`${protocol}://${host}`);
  const socialImageUrl = new URL("/og.png", baseUrl).toString();

  return {
    metadataBase: baseUrl,
    title: {
      default: "folio.ai — GitHub 포트폴리오 AI",
      template: "%s · folio.ai",
    },
    description:
      "GitHub 저장소 속 선택과 성과를 읽고, 지원 직무에 맞는 취업 포트폴리오로 정리합니다.",
    keywords: ["취업 포트폴리오", "GitHub", "개발자 포트폴리오", "AI"],
    openGraph: {
      type: "website",
      locale: "ko_KR",
      url: baseUrl.toString(),
      siteName: "folio.ai",
      title: "내 코드가, 가장 설득력 있는 소개가 되도록.",
      description: "GitHub 저장소를 지원 직무에 맞는 포트폴리오로 바꿔보세요.",
      images: [
        {
          url: socialImageUrl,
          width: 1792,
          height: 934,
          alt: "GitHub 저장소를 포트폴리오로 바꾸는 folio.ai",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "내 코드가, 가장 설득력 있는 소개가 되도록.",
      description: "GitHub 저장소를 지원 직무에 맞는 포트폴리오로 바꿔보세요.",
      images: [socialImageUrl],
    },
  };
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    /*
      html에 scroll-behavior: smooth가 걸려 있어(globals.css), 화면을 옮길
      때마다 맨 위로 스크롤되는 것까지 애니메이션이 됐다. 화면 전환이 느려
      보이고, 전환 직후 본문에 포커스를 옮기는 처리와도 맞물려 어긋난다.
      이 표시를 달면 Next가 화면 전환 동안에만 부드러움을 끄고, 문서 안의
      목차 링크(#portfolio-work 등)에는 그대로 남긴다.
    */
    <html lang="ko" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
