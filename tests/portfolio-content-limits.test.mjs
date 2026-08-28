import assert from "node:assert/strict";
import test from "node:test";

const { mapPortfolioContent } = await import(new URL("../server/portfolio/mapper.ts", import.meta.url));

const repository = {
  id: "repo_1",
  githubRepositoryId: "1",
  owner: { username: "example", avatarUrl: null },
  name: "portfolio-api",
  fullName: "example/portfolio-api",
  description: null,
  htmlUrl: "https://github.com/example/portfolio-api",
  defaultBranch: "main",
  primaryLanguage: "TypeScript",
  visibility: "public",
  starCount: 3,
  forkCount: 0,
  pushedAt: "2026-08-01T00:00:00.000Z",
  syncedAt: "2026-08-01T00:00:00.000Z",
};

const range = (n, prefix) => Array.from({ length: n }, (_, i) => `${prefix}-${i + 1}`);

// 규격 이전에 저장된 결과와 상한을 어긴 모델 응답을 모두 대표한다.
const oversized = {
  profile: { displayName: "김코드", headline: "헤드라인", targetRole: "Frontend Engineer", avatarUrl: null },
  introduction: "소개",
  skills: range(7, "카테고리").map((category) => ({ category, skills: range(10, "스킬") })),
  projects: [{
    id: "p1",
    title: "프로젝트",
    description: "설명",
    repositoryUrl: repository.htmlUrl,
    role: "프로젝트 개발",
    techStack: range(13, "기술"),
    highlights: range(7, "성과"),
    challenges: range(6, "문제"),
    solutions: range(6, "해결"),
    impact: range(5, "영향"),
  }],
  gitAnalysis: {
    summary: "요약",
    primaryLanguage: "TypeScript",
    languages: [{ name: "TypeScript", percentage: 90 }],
    starCount: 3,
    forkCount: 0,
    notablePatterns: range(9, "패턴"),
  },
  contact: { githubUrl: repository.htmlUrl, email: null, location: null },
};

test("결과 화면이 감당할 수 있는 분량으로 배열을 자른다", () => {
  const content = mapPortfolioContent(oversized, repository, "Frontend Engineer");
  const [project] = content.projects;

  assert.equal(content.skills.length, 5);
  assert.ok(content.skills.every((group) => group.skills.length <= 8));
  assert.equal(project.techStack.length, 10);
  assert.equal(project.highlights.length, 4);
  assert.equal(project.challenges.length, 3);
  assert.equal(project.solutions.length, 3);
  assert.equal(project.impact.length, 3);
  assert.equal(content.gitAnalysis.notablePatterns.length, 4);
});

test("상한 안에서는 앞쪽 항목을 순서대로 남긴다", () => {
  const content = mapPortfolioContent(oversized, repository, "Frontend Engineer");

  assert.deepEqual(content.projects[0].highlights, ["성과-1", "성과-2", "성과-3", "성과-4"]);
  assert.equal(content.skills[0].category, "카테고리-1");
});

test("상한보다 적은 내용은 그대로 두고 빈 배열도 유지한다", () => {
  const sparse = {
    ...oversized,
    projects: [{ ...oversized.projects[0], techStack: ["React"], highlights: [], impact: [] }],
    gitAnalysis: { ...oversized.gitAnalysis, notablePatterns: [] },
  };

  const content = mapPortfolioContent(sparse, repository, "Frontend Engineer");

  assert.deepEqual(content.projects[0].techStack, ["React"]);
  assert.deepEqual(content.projects[0].highlights, []);
  assert.deepEqual(content.projects[0].impact, []);
  assert.deepEqual(content.gitAnalysis.notablePatterns, []);
});

test("location과 avatarUrl이 없으면 null을 유지해 화면이 값을 지어내지 않게 한다", () => {
  const content = mapPortfolioContent(oversized, repository, "Frontend Engineer");

  assert.equal(content.contact.location, null);
  assert.equal(content.profile.avatarUrl, null);
});
