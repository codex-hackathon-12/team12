import assert from "node:assert/strict";
import test from "node:test";

const {
  LANGUAGE_ALL,
  LANGUAGE_NONE,
  filterRepositories,
  languageColor,
  languageFacets,
  sortRepositories,
} = await import(new URL("../lib/repository-list.ts", import.meta.url));

const repository = (overrides) => ({
  id: overrides.id,
  githubRepositoryId: overrides.id,
  owner: { username: "chorock", avatarUrl: "" },
  name: overrides.name,
  fullName: `chorock/${overrides.name}`,
  description: overrides.description ?? null,
  htmlUrl: "",
  defaultBranch: "main",
  primaryLanguage: overrides.primaryLanguage ?? null,
  visibility: overrides.visibility ?? "public",
  starCount: overrides.starCount ?? 0,
  forkCount: 0,
  pushedAt: overrides.pushedAt ?? "2026-01-01T00:00:00.000Z",
  syncedAt: "2026-08-31T00:00:00.000Z",
});

const repositories = [
  repository({ id: "1", name: "folio-maker", description: "포트폴리오 생성", primaryLanguage: "TypeScript", pushedAt: "2026-08-30T00:00:00.000Z" }),
  repository({ id: "2", name: "clock-api", primaryLanguage: "Python", visibility: "private", pushedAt: "2026-08-12T00:00:00.000Z" }),
  repository({ id: "3", name: "Alpha-site", description: "TypeScript 홈페이지", primaryLanguage: "TypeScript", starCount: 7, pushedAt: "2026-07-03T00:00:00.000Z" }),
  repository({ id: "4", name: "notes", pushedAt: "2026-06-21T00:00:00.000Z" }),
];

test("언어 목록은 개수와 함께, 많은 순으로 준다", () => {
  const facets = languageFacets(repositories);
  assert.deepEqual(facets.map((facet) => [facet.value, facet.count]), [
    ["TypeScript", 2],
    ["Python", 1],
    [LANGUAGE_NONE, 1],
  ]);
  // 언어가 없는 저장소도 고를 수 있어야 한다. "전체"와 구분되는 값이어야 한다.
  assert.equal(facets.find((facet) => facet.value === LANGUAGE_NONE).label, "언어 없음");
  // 나머지를 담는 칸이므로 개수와 무관하게 맨 뒤에 둔다.
  assert.equal(facets.at(-1).value, LANGUAGE_NONE);
});

test("검색은 이름과 설명 양쪽을 본다", () => {
  const base = { visibility: "all", language: LANGUAGE_ALL };
  assert.deepEqual(
    filterRepositories(repositories, { ...base, q: "folio" }).map((item) => item.id),
    ["1"],
  );
  // 설명에만 있는 낱말도 걸려야 한다.
  assert.deepEqual(
    filterRepositories(repositories, { ...base, q: "홈페이지" }).map((item) => item.id),
    ["3"],
  );
});

test("공개 범위와 언어 필터가 함께 적용된다", () => {
  assert.deepEqual(
    filterRepositories(repositories, { q: "", visibility: "private", language: LANGUAGE_ALL })
      .map((item) => item.id),
    ["2"],
  );
  assert.deepEqual(
    filterRepositories(repositories, { q: "", visibility: "all", language: "TypeScript" })
      .map((item) => item.id),
    ["1", "3"],
  );
  assert.deepEqual(
    filterRepositories(repositories, { q: "", visibility: "all", language: LANGUAGE_NONE })
      .map((item) => item.id),
    ["4"],
  );
});

test("정렬 세 가지가 각각 동작한다", () => {
  assert.deepEqual(sortRepositories(repositories, "recent").map((item) => item.id), ["1", "2", "3", "4"]);
  assert.deepEqual(sortRepositories(repositories, "name").map((item) => item.id), ["3", "2", "1", "4"]);
  assert.equal(sortRepositories(repositories, "stars")[0].id, "3");
});

test("스타가 동률이면 최근 순으로 갈린다", () => {
  // 대부분의 저장소가 0으로 동률이라 2차 기준이 없으면 순서가 들쭉날쭉해 보인다.
  const tied = sortRepositories(repositories, "stars").slice(1).map((item) => item.id);
  assert.deepEqual(tied, ["1", "2", "4"]);
});

test("정렬이 원본 배열을 건드리지 않는다", () => {
  const before = repositories.map((item) => item.id);
  sortRepositories(repositories, "name");
  assert.deepEqual(repositories.map((item) => item.id), before);
});

test("언어 색은 모르는 언어와 없음에 기본값을 준다", () => {
  assert.notEqual(languageColor("TypeScript"), languageColor(null));
  assert.equal(languageColor(null), languageColor("듣도 보도 못한 언어"));
});
