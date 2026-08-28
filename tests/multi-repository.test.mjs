import assert from "node:assert/strict";
import test from "node:test";

const { mapPortfolio } = await import(new URL("../server/portfolio/mapper.ts", import.meta.url));
const { buildPortfolioPrompt } = await import(new URL("../server/openai/portfolio-prompt.ts", import.meta.url));

const repositoryRecord = (id, name) => ({
  id,
  github_repository_id: 1,
  owner_username: "example",
  owner_avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
  name,
  full_name: `example/${name}`,
  description: null,
  html_url: `https://github.com/example/${name}`,
  default_branch: "main",
  primary_language: "TypeScript",
  visibility: "public",
  star_count: 1,
  fork_count: 0,
  pushed_at: "2026-08-01T00:00:00.000Z",
  synced_at: "2026-08-01T00:00:00.000Z",
});

const baseRecord = {
  id: "portfolio_1",
  generation_job_id: "job_1",
  title: "포트폴리오",
  target_role: "Frontend Engineer",
  content: { projects: [], skills: [], gitAnalysis: {}, contact: {}, profile: {} },
  style: "default",
  created_at: "2026-08-01T00:00:00.000Z",
  updated_at: "2026-08-01T00:00:00.000Z",
};

test("연결된 저장소를 position 순서대로 돌려준다", () => {
  const portfolio = mapPortfolio({
    ...baseRecord,
    repositories: repositoryRecord("repo_a", "alpha"),
    portfolio_repositories: [
      { position: 2, repositories: repositoryRecord("repo_c", "charlie") },
      { position: 0, repositories: repositoryRecord("repo_a", "alpha") },
      { position: 1, repositories: repositoryRecord("repo_b", "bravo") },
    ],
  });

  assert.deepEqual(portfolio.repositories.map((item) => item.name), ["alpha", "bravo", "charlie"]);
  assert.equal(portfolio.repositoryCount, 3);
  assert.equal(portfolio.repository.name, "alpha");
});

test("연결 정보가 없는 예전 포트폴리오는 대표 저장소 하나로 본다", () => {
  const portfolio = mapPortfolio({
    ...baseRecord,
    repositories: repositoryRecord("repo_a", "alpha"),
    portfolio_repositories: [],
  });

  assert.equal(portfolio.repositoryCount, 1);
  assert.deepEqual(portfolio.repositories.map((item) => item.name), ["alpha"]);
});

test("저장소가 없으면 포트폴리오를 만들지 않는다", () => {
  const portfolio = mapPortfolio({ ...baseRecord, repositories: null });

  assert.equal(portfolio, null);
});

const evidenceRepository = (name) => ({
  id: `repo_${name}`,
  name,
  description: null,
  url: `https://github.com/example/${name}`,
  primaryLanguage: "TypeScript",
  starCount: 0,
  forkCount: 0,
  languages: [{ name: "TypeScript", percentage: 100 }],
  readme: `# ${name}`,
  commitTitles: [],
  pullRequestTitles: [],
});

test("프롬프트 입력에 저장소 전체가 순서대로 담긴다", () => {
  const prompt = buildPortfolioPrompt({
    repositories: [evidenceRepository("alpha"), evidenceRepository("bravo")],
    targetRole: "Frontend Engineer",
    tone: "professional",
    prompt: "React 경험을 보여줘.",
    highlights: [],
  });

  const input = JSON.parse(prompt.input);
  assert.deepEqual(input.repositoryEvidence.repositories.map((item) => item.name), ["alpha", "bravo"]);
  // 내부 id는 모델에 노출하지 않는다.
  assert.equal(input.repositoryEvidence.repositories[0].id, undefined);
});

test("지침이 저장소당 프로젝트 하나와 repositoryName 표기를 요구한다", () => {
  const prompt = buildPortfolioPrompt({
    repositories: [evidenceRepository("alpha")],
    targetRole: "Frontend Engineer",
    tone: "concise",
    prompt: "정리해줘.",
    highlights: [],
  });

  assert.match(prompt.instructions, /저장소 하나당 프로젝트 하나/u);
  assert.match(prompt.instructions, /repositoryName/u);
});

const { resolveProjectRepositories, mergeLanguages } = await import(
  new URL("../server/generation/repository-matching.ts", import.meta.url)
);

test("repositoryName으로 프로젝트를 원래 저장소에 연결한다", () => {
  const repositories = [evidenceRepository("alpha"), evidenceRepository("bravo")];
  // 모델이 순서를 뒤집어 보내도 이름으로 되찾아야 한다.
  const resolved = resolveProjectRepositories(
    [{ repositoryName: "bravo" }, { repositoryName: "alpha" }],
    repositories,
  );

  assert.deepEqual(resolved.map((item) => item.name), ["bravo", "alpha"]);
});

test("이름이 어긋나면 남은 저장소를 순서대로 배정한다", () => {
  const repositories = [evidenceRepository("alpha"), evidenceRepository("bravo")];
  const resolved = resolveProjectRepositories(
    [{ repositoryName: "존재하지 않는 이름" }, { repositoryName: "bravo" }],
    repositories,
  );

  // bravo는 이름으로 잡히고, 남은 alpha가 첫 프로젝트로 간다.
  assert.deepEqual(resolved.map((item) => item.name), ["alpha", "bravo"]);
});

test("같은 이름을 두 번 보내도 저장소를 중복 배정하지 않는다", () => {
  const repositories = [evidenceRepository("alpha"), evidenceRepository("bravo")];
  const resolved = resolveProjectRepositories(
    [{ repositoryName: "alpha" }, { repositoryName: "alpha" }],
    repositories,
  );

  assert.deepEqual(resolved.map((item) => item.name), ["alpha", "bravo"]);
});

test("여러 저장소의 언어 비율을 전체 대비 비중으로 합친다", () => {
  const merged = mergeLanguages([
    { ...evidenceRepository("alpha"), languages: [{ name: "TypeScript", percentage: 100 }] },
    { ...evidenceRepository("bravo"), languages: [{ name: "Python", percentage: 60 }, { name: "TypeScript", percentage: 40 }] },
  ]);

  assert.deepEqual(merged, [
    { name: "TypeScript", percentage: 70 },
    { name: "Python", percentage: 30 },
  ]);
});
