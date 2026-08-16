"use client";

import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [repositories, setRepositories] = useState<GitRepositoryDto[] | null>(null);
  const [query, setQuery] = useState("");
  const [visibility, setVisibility] = useState<RepositoryVisibility | "all">("all");
  const [syncing, setSyncing] = useState(false);
  const [selectedRepositoryIds, setSelectedRepositoryIds] = useState<string[]>([]);

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

  const toggleRepository = (repositoryId: string) => {
    setSelectedRepositoryIds((current) =>
      current.includes(repositoryId)
        ? current.filter((id) => id !== repositoryId)
        : [...current, repositoryId],
    );
  };

  const continueToPrompt = () => {
    if (selectedRepositoryIds.length === 0) return;
    const queryString = new URLSearchParams({
      repositories: selectedRepositoryIds.join(","),
    }).toString();
    router.push(`/create/${selectedRepositoryIds[0]}/prompt?${queryString}`);
  };

  return (
    <div className="page-container repositories-page">
      <header className="repository-topbar">
        <div>
          <p className="eyebrow">STEP 01 · SELECT SOURCE</p>
          <p className="repository-instruction">
            포트폴리오에 담을 저장소를 하나 이상 선택하세요.
          </p>
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
          {repositories.map((repository, index) => {
            const isSelected = selectedRepositoryIds.includes(repository.id);
            return (
              <button
                type="button"
                className={`repository-row ${isSelected ? "selected" : ""}`}
                key={repository.id}
                aria-pressed={isSelected}
                onClick={() => toggleRepository(repository.id)}
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
                  <span>{isSelected ? "선택됨" : "선택하기"}</span>
                  <strong aria-hidden="true">{isSelected ? "✓" : "+"}</strong>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className={`repository-selection-bar ${selectedRepositoryIds.length > 0 ? "visible" : ""}`}>
        <div>
          <span>선택한 저장소</span>
          <strong>{selectedRepositoryIds.length}개</strong>
          <small>예상 비용 {selectedRepositoryIds.length * 30} 크레딧 · 실제 차감 없음</small>
        </div>
        <button
          className="button primary"
          type="button"
          disabled={selectedRepositoryIds.length === 0}
          onClick={continueToPrompt}
        >
          선택 완료 <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  );
}
