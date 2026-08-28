import assert from "node:assert/strict";
import test from "node:test";

const { toSlugBase, buildPortfolioSlug, buildShareUrl, toShareDto } = await import(
  new URL("../server/portfolio/sharing.ts", import.meta.url)
);
const { mapPublicPortfolio } = await import(new URL("../server/portfolio/mapper.ts", import.meta.url));

test("슬러그는 영문과 숫자만 남긴다", () => {
  assert.equal(toSlugBase("ChoRock Kim", "Frontend Engineer"), "chorock-kim-frontend-engineer");
  assert.equal(toSlugBase("Octo  Cat!!", "Backend"), "octo-cat-backend");
});

test("한글만 있으면 고정 문자열로 대체한다", () => {
  // 한글을 그대로 두면 URL이 퍼센트 인코딩으로 지저분해진다.
  assert.equal(toSlugBase("김초록", "프론트엔드"), "portfolio");
  assert.equal(toSlugBase(null, undefined), "portfolio");
});

test("슬러그에는 충돌을 막는 임의 접미사가 붙는다", () => {
  const a = buildPortfolioSlug("ChoRock Kim", "Frontend Engineer");
  const b = buildPortfolioSlug("ChoRock Kim", "Frontend Engineer");

  assert.match(a, /^chorock-kim-frontend-engineer-[a-z0-9]{6}$/u);
  assert.notEqual(a, b);
});

test("공유 URL은 기준 주소의 끝 슬래시를 정리한다", () => {
  assert.equal(buildShareUrl("abc-123", "https://folio.example/"), "https://folio.example/p/abc-123");
  assert.equal(buildShareUrl("abc-123", "https://folio.example"), "https://folio.example/p/abc-123");
});

test("비공개면 URL을 비우고 슬러그는 유지한다", () => {
  // 다시 공개했을 때 이미 보낸 링크가 살아 있어야 한다.
  const share = toShareDto({ public_slug: "abc-123", published_at: null }, "https://folio.example");

  assert.equal(share.published, false);
  assert.equal(share.slug, "abc-123");
  assert.equal(share.url, null);
});

test("공개면 URL을 만든다", () => {
  const share = toShareDto(
    { public_slug: "abc-123", published_at: "2026-08-30T00:00:00.000Z" },
    "https://folio.example",
  );

  assert.equal(share.published, true);
  assert.equal(share.url, "https://folio.example/p/abc-123");
});

const repositoryRecord = {
  id: "repo_secret",
  github_repository_id: 1,
  owner_username: "example",
  owner_avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
  name: "alpha",
  full_name: "example/alpha",
  description: null,
  html_url: "https://github.com/example/alpha",
  default_branch: "main",
  primary_language: "TypeScript",
  visibility: "public",
  star_count: 1,
  fork_count: 0,
  pushed_at: "2026-08-01T00:00:00.000Z",
  synced_at: "2026-08-01T00:00:00.000Z",
};

const record = {
  id: "portfolio_secret",
  generation_job_id: "job_secret",
  public_slug: "alpha-a1b2c3",
  published_at: "2026-08-30T00:00:00.000Z",
  title: "포트폴리오",
  target_role: "Frontend Engineer",
  content: { profile: {}, skills: [], projects: [], gitAnalysis: {}, contact: {} },
  style: "default",
  created_at: "2026-08-01T00:00:00.000Z",
  updated_at: "2026-08-01T00:00:00.000Z",
  repositories: repositoryRecord,
  portfolio_repositories: [{ position: 0, repositories: repositoryRecord }],
};

test("공개 매핑은 소유자를 식별할 값을 담지 않는다", () => {
  const portfolio = mapPublicPortfolio(record, "alpha-a1b2c3");
  const serialized = JSON.stringify(portfolio);

  // 인증 없이 노출되는 응답이라 내부 식별자가 새면 안 된다.
  for (const secret of ["portfolio_secret", "job_secret", "repo_secret"]) {
    assert.ok(!serialized.includes(secret), `${secret}가 공개 응답에 포함됐다`);
  }
  assert.deepEqual(Object.keys(portfolio).sort(), [
    "content", "createdAt", "repositories", "slug", "targetRole", "title",
  ]);
});

test("공개 매핑은 저장소의 공개 정보만 담는다", () => {
  const portfolio = mapPublicPortfolio(record, "alpha-a1b2c3");

  assert.deepEqual(portfolio.repositories, [
    { name: "alpha", fullName: "example/alpha", htmlUrl: "https://github.com/example/alpha" },
  ]);
});
