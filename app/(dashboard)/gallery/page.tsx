"use client";

import Link from "next/link";
import { useState } from "react";
import { apiClient } from "@/lib/api-client";
import { useAsyncData } from "@/hooks/useAsyncData";
import { LoadingState } from "@/components/ui/LoadingState";

const roles = [
  "전체",
  "Frontend Engineer",
  "Backend Engineer",
  "Product Engineer",
  "Android Engineer",
];

export default function GalleryPage() {
  const [role, setRole] = useState("전체");

  const { data: gallery, error: loadError, reload } = useAsyncData(
    () => apiClient.getGallery({ role: role === "전체" ? undefined : role }),
    [role],
    "포트폴리오 예시를 불러오지 못했어요.",
  );
  const examples = gallery?.examples ?? null;

  return (
    <div className="page-container gallery-page">
      <header className="gallery-heading">
        <div>
          <p className="eyebrow">PORTFOLIO GALLERY</p>
          <h1>완성된 결과에서<br />나만의 방향을 찾아보세요.</h1>
        </div>
        <p>직무와 기술은 달라도 좋은 포트폴리오에는 분명한 맥락과 선택의 이유가 있습니다.</p>
      </header>

      <div className="gallery-filters" aria-label="직무 필터">
        {roles.map((item) => (
          <button
            type="button"
            key={item}
            className={role === item ? "active" : ""}
            onClick={() => setRole(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {loadError ? (
        <p className="inline-error" role="alert">
          {loadError}
          <button type="button" onClick={reload}>다시 불러오기</button>
        </p>
      ) : !examples ? (
        <LoadingState label="포트폴리오 예시를 모으고 있어요" />
      ) : examples.length === 0 ? (
        <div className="empty-state">
          <span>NO MATCH</span>
          <h2>선택한 직무의 예시를 준비 중이에요.</h2>
          <button className="text-link" type="button" onClick={() => setRole("전체")}>전체 보기 →</button>
        </div>
      ) : (
        <div className="gallery-grid">
          {examples.map((example, index) => (
            <Link className={`gallery-card gallery-accent-${index % 6}`} href={`/gallery/${example.id}`} key={example.id}>
              <div className="gallery-visual">
                <div className="mini-browser-bar"><span /><span /><span /></div>
                <div className="mini-portfolio">
                  <small>PORTFOLIO · 2026</small>
                  <strong>{example.targetRole.split(" ")[0]}</strong>
                  <span />
                  <span />
                  <div>
                    {example.techStack.slice(0, 3).map((tech) => <i key={tech}>{tech}</i>)}
                  </div>
                </div>
                <span className="gallery-number">0{index + 1}</span>
              </div>
              <div className="gallery-card-copy">
                <span>{example.targetRole}</span>
                <h2>{example.title}</h2>
                <p>{example.description}</p>
                <div className="tag-row">
                  {example.techStack.map((tech) => <span className="plain-tag" key={tech}>{tech}</span>)}
                </div>
              </div>
              <span className="gallery-arrow" aria-hidden="true">↗</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
