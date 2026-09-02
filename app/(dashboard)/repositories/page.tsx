"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  MAX_GENERATION_REPOSITORIES,
  type GitRepositoryDto,
  type RepositoryVisibility,
} from "@/contracts/api-contract";
import { apiClient } from "@/lib/api-client";
import { loadAllRepositories } from "@/lib/api-client/load-all-repositories";
import { formatListDay } from "@/lib/format";
import {
  LANGUAGE_ALL,
  filterRepositories,
  languageColor,
  languageFacets,
  sortRepositories,
  type RepositorySort,
} from "@/lib/repository-list";
import { LoadingState } from "@/components/ui/LoadingState";
import { MOCK_CHIP } from "@/lib/copy";
import { LABEL } from "@/lib/copy";

const visibilityOptions: Array<RepositoryVisibility | "all"> = [
  "all",
  "public",
  "private",
];

const sortOptions: Array<{ value: RepositorySort; label: string }> = [
  { value: "recent", label: "최근 순" },
  { value: "name", label: "이름 순" },
  { value: "stars", label: "스타 많은 순" },
];

export default function RepositoriesPage() {
  const router = useRouter();
  const [repositories, setRepositories] = useState<GitRepositoryDto[] | null>(null);
  const [query, setQuery] = useState("");
  const [visibility, setVisibility] = useState<RepositoryVisibility | "all">("all");
  const [language, setLanguage] = useState(LANGUAGE_ALL);
  const [sort, setSort] = useState<RepositorySort>("recent");
  const [syncing, setSyncing] = useState(false);
  const [selectedRepositoryIds, setSelectedRepositoryIds] = useState<string[]>([]);
  const [capNotice, setCapNotice] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  /* 목록 전체를 한 번에 받아둔다. 그래야 검색이 즉시 반응하고, 정렬과 언어
     집계가 전체 집합 기준이 되어 정확해진다. 이 화면이 목록을 직접 들고 있는
     이유는 동기화가 목록을 통째로 갈아끼우기 때문이다. */
  useEffect(() => {
    let active = true;
    loadAllRepositories((page) => apiClient.getRepositories(page))
      .then((result) => {
        if (!active) return;
        setRepositories(result);
        setLoadError(null);
      })
      .catch(() => {
        if (active) setLoadError("저장소 목록을 불러오지 못했어요.");
      });
    return () => {
      active = false;
    };
  }, [reloadToken]);

  const facets = useMemo(() => languageFacets(repositories ?? []), [repositories]);

  const visible = useMemo(
    () =>
      sortRepositories(
        filterRepositories(repositories ?? [], { q: query, visibility, language }),
        sort,
      ),
    [repositories, query, visibility, language, sort],
  );

  /* 칩은 걸러진 목록이 아니라 전체에서 찾는다. TypeScript로 좁힌 상태에서도
     앞서 고른 Python 저장소의 칩이 남아 있어야 한다. */
  const selectedRepositories = useMemo(() => {
    const byId = new Map((repositories ?? []).map((repository) => [repository.id, repository]));
    return selectedRepositoryIds
      .map((id) => byId.get(id))
      .filter((repository): repository is GitRepositoryDto => Boolean(repository));
  }, [repositories, selectedRepositoryIds]);

  const atCap = selectedRepositoryIds.length >= MAX_GENERATION_REPOSITORIES;

  // 실패해도 진행 표시를 반드시 되돌린다. 아니면 버튼이 영영 잠긴다.
  const sync = async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      const response = await apiClient.syncRepositories();
      setRepositories(response.repositories);
      // 동기화로 사라진 저장소가 선택 목록에 남아 있으면 안 된다.
      setSelectedRepositoryIds((current) =>
        current.filter((id) => response.repositories.some((repository) => repository.id === id)),
      );
    } catch {
      setSyncError("GitHub에서 저장소를 가져오지 못했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setSyncing(false);
    }
  };

  /* 상태 갱신 함수 안에서 다른 상태를 건드리지 않는다. 갱신 함수는 순수해야
     하고 개발 모드에서 두 번 실행될 수 있다. 판단은 여기서 먼저 한다. */
  const toggleRepository = (repositoryId: string) => {
    if (selectedRepositoryIds.includes(repositoryId)) {
      setSelectedRepositoryIds((current) => current.filter((id) => id !== repositoryId));
      setCapNotice(null);
      return;
    }
    if (atCap) {
      // 예전에는 아무 일도 일어나지 않아 버튼이 고장 난 것처럼 보였다.
      setCapNotice(
        `최대 ${MAX_GENERATION_REPOSITORIES}개까지 고를 수 있어요. 아래에서 하나를 빼고 다시 선택해주세요.`,
      );
      return;
    }
    setSelectedRepositoryIds((current) => [...current, repositoryId]);
    setCapNotice(null);
  };

  const clearFilters = () => {
    setQuery("");
    setVisibility("all");
    setLanguage(LANGUAGE_ALL);
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
        {/* 이 화면들은 시각적 제목이 없는 디자인이다. 화면에서는 내비게이션이
            강조돼 지금 어디인지 알 수 있지만, 낭독기에는 그 단서가 없다.
            제목 하나로 이동하는 사용자에게 화면 이름을 준다(SC 2.4.6).
            내비게이션 라벨과 같은 말을 써야 눌러서 온 링크와 이어진다. */}
        <h1 className="sr-only">{LABEL.create}</h1>
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

        <label className="filter-select">
          <span className="sr-only">언어</span>
          <select value={language} onChange={(event) => setLanguage(event.target.value)}>
            <option value={LANGUAGE_ALL}>언어 전체</option>
            {facets.map((facet) => (
              <option key={facet.value} value={facet.value}>
                {facet.label} ({facet.count})
              </option>
            ))}
          </select>
        </label>

        <div className="segmented-control" aria-label="저장소 공개 범위">
          {visibilityOptions.map((option) => (
            <button
              type="button"
              key={option}
              className={visibility === option ? "active" : ""}
              aria-pressed={visibility === option}
              onClick={() => setVisibility(option)}
            >
              {option === "all" ? "전체" : option === "public" ? "공개" : "비공개"}
            </button>
          ))}
        </div>

        <label className="filter-select">
          <span className="sr-only">정렬</span>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as RepositorySort)}
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <button className="button subtle" type="button" onClick={sync} disabled={syncing}>
          {syncing ? "동기화 중…" : "↻ 새로고침"}
        </button>
      </section>

      {syncError ? <p className="inline-error" role="alert">{syncError}</p> : null}

      {/* 개수 알림은 어떤 분기에도 들어가면 안 된다. 예전에는 목록 안에 있어서
          결과가 0건이 되는 바로 그 순간 알림 영역째 사라졌고, 화면 낭독기는
          아무것도 듣지 못했다. 살아 있는 영역이어야 변화가 읽힌다. */}
      {repositories ? (
        <div className="list-caption">
          <span aria-live="polite">
            {visible.length}개 표시 · 전체 {repositories.length}개
          </span>
          <span className={atCap ? "at-cap" : undefined} aria-live="polite">
            {selectedRepositoryIds.length}/{MAX_GENERATION_REPOSITORIES} 선택
          </span>
        </div>
      ) : null}

      {loadError ? (
        <p className="inline-error" role="alert">
          {loadError}
          <button type="button" onClick={() => setReloadToken((value) => value + 1)}>
            다시 불러오기
          </button>
        </p>
      ) : !repositories ? (
        <LoadingState label="GitHub 저장소를 불러오고 있어요" />
      ) : repositories.length === 0 ? (
        /* 저장소가 아예 없는 사람에게 "필터를 바꿔보세요"라고 하면 할 수 없는 일을
           시키는 셈이다. 필터로 걸러진 경우와 갈라놓는다. */
        <div className="empty-state">
          <span>NO REPOSITORY</span>
          <h2>GitHub에 아직 저장소가 없어요.</h2>
          <p>저장소를 만든 뒤 새로고침하면 여기에 나타나요.</p>
          <button className="button secondary" type="button" onClick={sync} aria-disabled={syncing}>
            {syncing ? "동기화 중…" : "다시 불러오기"}
          </button>
        </div>
      ) : visible.length === 0 ? (
        <div className="empty-state">
          <span>NO MATCH</span>
          <h2>
            {query.trim()
              ? `‘${query.trim()}’에 맞는 저장소가 없어요.`
              : "조건에 맞는 저장소가 없어요."}
          </h2>
          <p>검색어를 지우거나 언어·공개 범위 필터를 바꿔보세요.</p>
          <button className="button secondary" type="button" onClick={clearFilters}>
            필터 지우기
          </button>
        </div>
      ) : (
        <div className="repository-list">
          {/* 목록이 길어 탭으로만 이동하면 아래 선택 바까지 가는 데 오래 걸린다.
              대상이 있을 때만 내보낸다 — 선택이 없으면 선택 바 자체가 없다. */}
          {selectedRepositories.length > 0 ? (
            <a className="sr-only sr-only-focusable" href="#repository-selection-bar">
              선택한 저장소로 건너뛰기
            </a>
          ) : null}

          <ul className="repository-rows" aria-label="저장소 목록">
            {visible.map((repository) => {
              const isSelected = selectedRepositoryIds.includes(repository.id);
              const blocked = atCap && !isSelected;
              return (
                <li
                  className={`repository-row${isSelected ? " selected" : ""}${blocked ? " blocked" : ""}`}
                  key={repository.id}
                >
                  <input
                    type="checkbox"
                    className="repository-checkbox"
                    id={`repository-${repository.id}`}
                    checked={isSelected}
                    aria-labelledby={`repository-name-${repository.id}`}
                    aria-describedby={
                      repository.description ? `repository-description-${repository.id}` : undefined
                    }
                    onChange={() => toggleRepository(repository.id)}
                  />
                  <label className="repository-row-label" htmlFor={`repository-${repository.id}`}>
                    <span
                      className="repository-name"
                      id={`repository-name-${repository.id}`}
                      title={repository.name}
                    >
                      {repository.visibility === "private" ? (
                        <>
                          <span className="repository-private" aria-hidden="true">
                            🔒
                          </span>
                          <span className="sr-only">비공개</span>
                        </>
                      ) : null}
                      {repository.name}
                    </span>
                    <span
                      className="repository-description"
                      id={`repository-description-${repository.id}`}
                      title={repository.description ?? undefined}
                    >
                      {repository.description}
                    </span>
                    <span className="repository-language">
                      {repository.primaryLanguage ? (
                        <>
                          <i
                            className="language-dot"
                            style={{ background: languageColor(repository.primaryLanguage) }}
                          />
                          {repository.primaryLanguage}
                        </>
                      ) : null}
                    </span>
                    <span className="repository-updated">
                      {formatListDay(repository.pushedAt)}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {selectedRepositories.length > 0 ? (
        <div className="repository-selection-bar" id="repository-selection-bar" tabIndex={-1}>
          <div className="selection-summary">
            <strong>
              {selectedRepositoryIds.length}/{MAX_GENERATION_REPOSITORIES}
            </strong>
            <span className="mock-chip">{MOCK_CHIP}</span>
          </div>

          <ul className="selection-chips">
            {selectedRepositories.map((repository) => (
              <li key={repository.id}>
                <span className="selection-chip">
                  <span title={repository.name}>{repository.name}</span>
                  <button
                    type="button"
                    className="selection-chip-remove"
                    onClick={() => toggleRepository(repository.id)}
                    aria-label={`${repository.name} 선택 해제`}
                  >
                    ✕
                  </button>
                </span>
              </li>
            ))}
          </ul>

          <button className="button primary" type="button" onClick={continueToPrompt}>
            선택 완료 <span aria-hidden="true">→</span>
          </button>

          {capNotice ? (
            <p className="cap-notice" role="status">
              {capNotice}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
