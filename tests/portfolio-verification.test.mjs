import assert from "node:assert/strict";
import test from "node:test";

const { verifySkillGroups, verifyTechStack } = await import(
  new URL("../server/portfolio/verification.ts", import.meta.url)
);

const evidence = {
  repositories: [
    {
      id: "repo_1",
      name: "folio-maker",
      description: "포트폴리오 생성 서비스",
      url: "https://github.com/example/folio-maker",
      primaryLanguage: "TypeScript",
      starCount: 0,
      forkCount: 0,
      pushedAt: "2026-08-01T00:00:00.000Z",
      languages: [{ name: "TypeScript", percentage: 90 }],
      readme: "Next.js와 Supabase로 만든 서비스입니다.",
      ownCommits: [{ title: "feat: Tailwind로 레이아웃 정리", body: "" }],
      ownContributionUnverifiable: false,
      dependencies: [],
      teamCommitTitles: [],
      ownPullRequests: [{ title: "PostgreSQL 인덱스 추가", merged: true, body: "" }],
      teamPullRequestTitles: [],
      topLevelPaths: ["app/", "package.json"],
      hasContinuousIntegration: false,
      contributorCount: 1,
    },
  ],
  targetRole: "Frontend Engineer",
  tone: "professional",
  prompt: "프론트엔드 중심으로 정리해줘",
  highlights: [],
};

test("근거에서 확인되는 기술은 남긴다", () => {
  const result = verifyTechStack(["TypeScript", "Next.js", "Supabase", "Tailwind"], evidence);
  assert.deepEqual(result.value, ["TypeScript", "Next.js", "Supabase", "Tailwind"]);
  assert.deepEqual(result.removed, []);
});

test("근거가 없는 기술은 걷어내고 무엇을 뺐는지 남긴다", () => {
  const result = verifyTechStack(["TypeScript", "Kubernetes"], evidence);
  assert.deepEqual(result.value, ["TypeScript"]);
  assert.deepEqual(result.removed, ["Kubernetes"]);
});

test("표기 차이는 같은 것으로 본다", () => {
  // README에는 "Next.js", 결과에는 "NextJS"로 적힐 수 있다.
  assert.deepEqual(verifyTechStack(["NextJS"], evidence).value, ["NextJS"]);
});

test("PR 본문과 사용자가 적은 강조점도 근거로 인정한다", () => {
  assert.deepEqual(verifyTechStack(["PostgreSQL"], evidence).value, ["PostgreSQL"]);
  const withHighlight = { ...evidence, highlights: ["Redis 캐시 도입"] };
  assert.deepEqual(verifyTechStack(["Redis"], withHighlight).value, ["Redis"]);
});

test("항목이 모두 빠진 그룹은 제목만 남지 않게 지운다", () => {
  const result = verifySkillGroups(
    [
      { category: "언어", skills: ["TypeScript"] },
      { category: "인프라", skills: ["Kubernetes", "Terraform"] },
    ],
    evidence,
  );
  assert.deepEqual(result.value, [{ category: "언어", skills: ["TypeScript"] }]);
  assert.deepEqual(result.removed, ["Kubernetes", "Terraform"]);
});

test("의존성에서 확인되는 프레임워크를 걷어내지 않는다", () => {
  /* 지시문은 dependencies를 techStack의 근거로 쓰라고 안내한다. 검증이 그걸
     모르면 "React를 쓰라"고 말해놓고 모델이 쓴 React를 도로 걷어낸다. */
  const withDependencies = {
    ...evidence,
    repositories: [{ ...evidence.repositories[0], readme: "", dependencies: ["react", "vitest"] }],
  };
  const result = verifyTechStack(["React", "Vitest"], withDependencies);
  assert.deepEqual(result.value, ["React", "Vitest"]);
  assert.deepEqual(result.removed, []);
});

test("지원자가 직접 답한 것도 근거로 인정한다", () => {
  /* 저장소 근거와 나란한 사실 층으로 쓰기로 해놓고 검증에서 빼면, 답변에만
     나오는 기술이 조용히 사라진다. */
  const withStatements = {
    ...evidence,
    repositories: [{ ...evidence.repositories[0], readme: "" }],
    applicantStatements: [{
      repositoryName: "folio-maker",
      field: "solutions",
      question: "그 문제를 어떻게 푸셨나요?",
      answer: "Redis에 결과를 캐시해서 같은 요청이 반복되지 않게 했어요.",
    }],
  };
  assert.deepEqual(verifyTechStack(["Redis"], withStatements).value, ["Redis"]);
});
