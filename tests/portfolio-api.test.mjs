import assert from "node:assert/strict";
import test from "node:test";

const {
  decodePortfolioCursor,
  encodePortfolioCursor,
  extractTechStack,
  mapPortfolio,
  mapPortfolioContent,
  mapPortfolioSummary,
  mapRepository,
} = await import(new URL("../server/portfolio/mapper.ts", import.meta.url));

const repositoryRecord = {
  id: "repo_123",
  github_repository_id: 887766,
  owner_username: "octocat",
  owner_avatar_url: "https://avatars.example.test/octocat.png",
  name: "portfolio-api",
  full_name: "octocat/portfolio-api",
  description: "취업 포트폴리오 생성 API",
  html_url: "https://github.com/octocat/portfolio-api",
  default_branch: "main",
  primary_language: "TypeScript",
  visibility: "private",
  star_count: 3,
  fork_count: 1,
  pushed_at: "2026-08-15T12:30:00.000Z",
  synced_at: "2026-08-16T04:00:00.000Z",
};

const storedContent = {
  profile: {
    displayName: "Octo Cat",
    headline: "확장 가능한 API를 설계하는 개발자",
    targetRole: "Backend Engineer",
    avatarUrl: "https://avatars.example.test/octocat.png",
  },
  introduction: "사용자 문제를 안정적인 API와 데이터 모델로 해결합니다.",
  skills: [{ category: "Backend", skills: ["TypeScript", "REST API"] }],
  projects: [{
    id: "project_123",
    title: "취업 포트폴리오 생성 API",
    description: "Git 저장소 분석 결과를 포트폴리오로 변환합니다.",
    repositoryUrl: "https://github.com/octocat/portfolio-api",
    role: "Backend Engineer",
    techStack: ["TypeScript", "Next.js"],
    highlights: ["비동기 생성 작업 설계"],
    challenges: [],
    solutions: [],
    impact: [],
  }],
  gitAnalysis: {
    summary: "API와 데이터 계층을 명확히 분리한 프로젝트입니다.",
    primaryLanguage: "TypeScript",
    languages: [{ name: "TypeScript", percentage: 82.5 }, { name: "CSS", percentage: 17.5 }],
    starCount: 3,
    forkCount: 1,
    notablePatterns: ["REST Route Handler"],
  },
  contact: {
    githubUrl: "https://github.com/octocat",
    email: "octocat@example.test",
    location: null,
  },
};

const portfolioRecord = {
  id: "portfolio_123",
  generation_job_id: "job_123",
  title: "문제 해결에 집중하는 백엔드 개발자",
  target_role: "Backend Engineer",
  content: storedContent,
  style: "default",
  resume_pdf_path: "user_123/portfolio_123.pdf",
  resume_pdf_generated_at: "2026-08-16T04:01:20.000Z",
  created_at: "2026-08-16T04:01:20.000Z",
  updated_at: "2026-08-16T04:01:20.000Z",
  repositories: repositoryRecord,
};

test("maps stored portfolio content and repository data to the public DTO", () => {
  const repository = mapRepository(repositoryRecord);
  const content = mapPortfolioContent(storedContent, repository, "Backend Engineer");
  const portfolio = mapPortfolio(portfolioRecord);

  assert.equal(repository.githubRepositoryId, "887766");
  assert.deepEqual(content.projects[0].techStack, ["TypeScript", "Next.js"]);
  assert.deepEqual(extractTechStack(content), ["TypeScript", "CSS", "Next.js", "REST API"]);
  assert.deepEqual(mapPortfolioSummary(portfolioRecord), {
    id: "portfolio_123",
    title: "문제 해결에 집중하는 백엔드 개발자",
    targetRole: "Backend Engineer",
    repositoryName: "portfolio-api",
    repositoryCount: 1,
    techStack: ["TypeScript", "CSS", "Next.js", "REST API"],
    createdAt: "2026-08-16T04:01:20.000Z",
  });
  assert.equal(portfolio.resumePdf.downloadUrl, "/api/v1/portfolios/portfolio_123/resume.pdf");
  assert.equal(portfolio.resumePdf.generatedAt, "2026-08-16T04:01:20.000Z");
  assert.equal(portfolio.style, "default");
});

test("does not expose a download URL when no resume path is stored", () => {
  const portfolio = mapPortfolio({ ...portfolioRecord, resume_pdf_path: null, resume_pdf_generated_at: null });

  assert.equal(portfolio.resumePdf, null);
});

test("uses an offset cursor that safely falls back for invalid values", () => {
  assert.equal(encodePortfolioCursor(20), "MjA=");
  assert.equal(decodePortfolioCursor("MjA="), 20);
  assert.equal(decodePortfolioCursor("not-a-cursor"), 0);
  assert.equal(decodePortfolioCursor(null), 0);
});
