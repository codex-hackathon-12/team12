"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { GalleryExampleDto } from "@/contracts/api-contract";
import { apiClient } from "@/lib/api-client";
import { PortfolioPreview } from "@/components/portfolio/PortfolioPreview";
import { LoadingState } from "@/components/ui/LoadingState";

export default function GalleryDetailPage() {
  const params = useParams<{ exampleId: string }>();
  const [example, setExample] = useState<GalleryExampleDto | null>(null);

  useEffect(() => {
    apiClient.getGalleryExample(String(params.exampleId)).then(setExample);
  }, [params.exampleId]);

  if (!example) return <LoadingState label="포트폴리오 예시를 펼치고 있어요" />;

  return (
    <div className="gallery-detail-page">
      <div className="page-container gallery-detail-header">
        <Link className="text-link" href="/gallery">← 갤러리로 돌아가기</Link>
        <div>
          <p className="eyebrow">CURATED EXAMPLE</p>
          <h1>{example.title}</h1>
          <p>{example.description}</p>
        </div>
        <Link className="button primary" href="/repositories">내 포트폴리오 만들기</Link>
      </div>
      <div className="portfolio-canvas-wrap gallery-canvas">
        <PortfolioPreview
          content={{
            ...example.portfolio,
            contact: { ...example.portfolio.contact, email: null },
          }}
        />
      </div>
    </div>
  );
}
