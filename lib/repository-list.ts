import type { GitRepositoryDto, RepositoryVisibility } from "@/contracts/api-contract";

/**
 * 저장소 목록을 좁히고 정렬하는 순수 함수들.
 *
 * 목록 전체를 한 번에 받아두고 여기서 거른다. 검색이 즉시 반응하고, 정렬과
 * 언어 집계가 전체 집합 기준이 되어 정확해진다. 서버에는 sort 파라미터가
 * 없으므로 페이지 단위로 정렬하면 틀린 결과가 나온다.
 */

/** 언어가 없는 저장소도 하나의 선택지다. 빈 문자열은 "전체"와 구분되지 않는다. */
export const LANGUAGE_NONE = "__none__";
export const LANGUAGE_ALL = "all";

export type RepositorySort = "recent" | "name" | "stars";

export type LanguageFacet = { value: string; label: string; count: number };

export type RepositoryFilter = {
  q: string;
  visibility: RepositoryVisibility | "all";
  language: string;
};

/**
 * 지금 목록에 실제로 존재하는 언어만, 개수와 함께 돌려준다.
 * 개수가 이 컨트롤의 값어치다. 고르기 전에 얼마나 줄어드는지 보인다.
 */
export function languageFacets(repositories: GitRepositoryDto[]): LanguageFacet[] {
  const counts = new Map<string, number>();
  for (const repository of repositories) {
    const key = repository.primaryLanguage ?? LANGUAGE_NONE;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([value, count]) => ({
      value,
      label: value === LANGUAGE_NONE ? "언어 없음" : value,
      count,
    }))
    .sort((a, b) => {
      /* "언어 없음"은 언어가 아니라 나머지를 담는 칸이다. 개수가 많아도
         언어들 사이에 끼워 넣으면 목록이 읽히지 않는다. */
      if (a.value === LANGUAGE_NONE) return 1;
      if (b.value === LANGUAGE_NONE) return -1;
      return b.count - a.count || a.label.localeCompare(b.label, "en");
    });
}

export function filterRepositories(
  repositories: GitRepositoryDto[],
  { q, visibility, language }: RepositoryFilter,
): GitRepositoryDto[] {
  const keyword = q.trim().toLowerCase();

  return repositories.filter((repository) => {
    if (visibility !== "all" && repository.visibility !== visibility) {
      return false;
    }
    if (language !== LANGUAGE_ALL) {
      const value = repository.primaryLanguage ?? LANGUAGE_NONE;
      if (value !== language) return false;
    }
    if (!keyword) return true;
    // 서버가 쓰던 조건과 같다. 검색이 클라이언트로 옮겨져도 동작이 그대로다.
    return (
      repository.name.toLowerCase().includes(keyword) ||
      (repository.description ?? "").toLowerCase().includes(keyword)
    );
  });
}

export function sortRepositories(
  repositories: GitRepositoryDto[],
  sort: RepositorySort,
): GitRepositoryDto[] {
  // 상태로 들고 있는 배열을 제자리 정렬하면 안 된다.
  const sorted = [...repositories];

  if (sort === "name") {
    return sorted.sort((a, b) => a.name.localeCompare(b.name, "ko-KR", { numeric: true }));
  }

  if (sort === "stars") {
    /* 대부분의 저장소가 0으로 동률이라 2차 기준이 없으면 순서가 들쭉날쭉해 보인다. */
    return sorted.sort(
      (a, b) => b.starCount - a.starCount || comparePushedAtDesc(a, b),
    );
  }

  return sorted.sort(comparePushedAtDesc);
}

function comparePushedAtDesc(a: GitRepositoryDto, b: GitRepositoryDto): number {
  return Date.parse(b.pushedAt) - Date.parse(a.pushedAt);
}

/* 점 하나로 "이 목록의 절반이 TypeScript"라는 사실이 먼저 읽히게 한다. */
const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572a5",
  HTML: "#e34c26",
  CSS: "#563d7c",
  Java: "#b07219",
  Kotlin: "#a97bff",
  Swift: "#f05138",
  Go: "#00add8",
  Rust: "#dea584",
  Shell: "#89e051",
  "Jupyter Notebook": "#da5b0b",
  EJS: "#a91e50",
  Dart: "#00b4ab",
  "C++": "#f34b7d",
  C: "#555555",
};

export function languageColor(language: string | null): string {
  return (language && LANGUAGE_COLORS[language]) || "var(--line-dark)";
}
