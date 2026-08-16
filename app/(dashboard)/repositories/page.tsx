"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type {
  GitRepositoryDto,
  RepositoryVisibility,
} from "@/contracts/api-contract";
import { apiClient } from "@/lib/api-client";
import { LoadingState } from "@/components/ui/LoadingState";

const visibilityOptions: Array<RepositoryVisibility | "all"> = [
  "all",
  "public",
  "private",
];

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));

export default function RepositoriesPage() {
  const [repositories, setRepositories] = useState<GitRepositoryDto[] | null>(null);
  const [query, setQuery] = useState("");
  const [visibility, setVisibility] = useState<RepositoryVisibility | "all">("all");
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    let active = true;
    apiClient.getRepositories({ q: query, visibility }).then((response) => {
      if (active) setRepositories(response.repositories);
    });
    return () => {
      active = false;
    };
  }, [query, visibility]);

  const sync = async () => {
    setSyncing(true);
    const response = await apiClient.syncRepositories();
    setRepositories(response.repositories);
    setSyncing(false);
  };

  return (
    <div className="page-container repositories-page">
      <header className="page-heading repository-heading">
        <div>
          <p className="eyebrow">STEP 01 · SELECT SOURCE</p>
          <h1>어떤 코드에서<br />이야기를 찾을까요?</h1>
          <p>GitHub에 연결된 저장소 중 포트폴리오로 만들 프로젝트를 선택하세요.</p>
        </div>
        <div className="github-account-card">
          <span className="github-glyph">GH</span>
          <div>
            <span>Connected as</span>
            <strong>@frontend-builder</strong>
          </div>
          <span className="connected-state">연결됨</span>
        </div>
      </header>

      <section className="repository-toolbar" aria-label="저장소 검색과 필터">
        <label className="search-field">
          <span aria-hidden="true">⌕</span>
          <span className="sr-only">저장소 검색</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="저장소 이름이나 설명 검색"
          />
        </label>
        <div className="segmented-control" aria-label="저장소 공개 범위">
          {visibilityOptions.map((option) => (
            <button
              type="button"
              key={option}
              className={visibility === option ? "active" : ""}
              onClick={() => setVisibility(option)}
            >
              {option === "all" ? "전체" : option === "public" ? "공개" : "비공개"}
            </button>
          ))}
        </div>
        <button className="button subtle" type="button" onClick={sync} disabled={syncing}>
          {syncing ? "동기화 중…" : "↻ 새로고침"}
        </button>
      </section>

      {!repositories ? (
        <LoadingState label="GitHub 저장소를 불러오고 있어요" />
      ) : repositories.length === 0 ? (
        <div className="empty-state">
          <span>0 results</span>
          <h2>조건에 맞는 저장소가 없어요.</h2>
          <p>검색어를 지우거나 공개 범위 필터를 바꿔보세요.</p>
        </div>
      ) : (
        <div className="repository-list">
          <div className="list-caption">
            <span>{repositories.length} repositories</span>
            <span>최근 업데이트 순</span>
          </div>
          {repositories.map((repository, index) => (
            <Link
              href={`/create/${repository.id}/prompt`}
              className="repository-row"
              key={repository.id}
            >
              <span className="repository-index">{String(index + 1).padStart(2, "0")}</span>
              <div className="repository-main">
                <div className="repository-title-line">
                  <h2>{repository.name}</h2>
                  <span className={`visibility-badge ${repository.visibility}`}>
                    {repository.visibility === "public" ? "Public" : "Private"}
                  </span>
                </div>
                <p>{repository.description}</p>
                <div className="repository-meta">
                  <span><i className="language-dot" />{repository.primaryLanguage}</span>
                  <span>★ {repository.starCount}</span>
                  <span>⑂ {repository.forkCount}</span>
                  <span>{formatDate(repository.pushedAt)} 업데이트</span>
                </div>
              </div>
              <div className="repository-select">
                <span>선택하기</span>
                <strong aria-hidden="true">→</strong>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
