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
      ownCommitDiffs: [],
      contributionPeriod: null,
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

/**
 * 서술문의 수치 검증.
 *
 * 문장 전체의 사실 여부는 코드가 판정할 수 없다. 수치 하나만 본다 — AI
 * 이력서의 붉은 깃발 1순위가 "지나치게 둥근 숫자"이고, 채용 담당자가 가장
 * 먼저 되묻는 것도 거기다.
 */

const { buildNumberSet, verifyNarrative } = await import(
  new URL("../server/portfolio/verification.ts", import.meta.url)
);

test("근거 어디에도 없는 수치가 든 문장을 뺀다", () => {
  const numbers = buildNumberSet('{"readme":"요청을 캐시해 중복 조회를 없앴습니다."}');
  const result = verifyNarrative(
    ["응답 속도를 30% 개선했다", "중복 조회를 없앴다"],
    numbers,
  );
  assert.deepEqual(result.value, ["중복 조회를 없앴다"]);
  assert.deepEqual(result.removed, ["응답 속도를 30% 개선했다"]);
});

test("근거에 있는 수치는 남긴다", () => {
  /* 판정은 보수적이다. 정당한 문장을 지우는 쪽이 더 큰 손해라, 근거 payload
     어디에든 그 숫자가 있으면 통과시킨다. */
  const numbers = buildNumberSet('{"languages":[{"name":"TypeScript","percentage":78.4}],"contributorCount":3}');
  const result = verifyNarrative(
    ["TypeScript가 78.4%를 차지하는 저장소를 만들었다", "3명이 함께 개발했다"],
    numbers,
  );
  assert.deepEqual(result.removed, []);
});

test("자릿수 쉼표 때문에 정당한 문장을 지우지 않는다", () => {
  // 근거는 "1200", 문장은 "1,200"으로 쓰는 것이 자연스럽다.
  const numbers = buildNumberSet('{"readme":"누적 1200건을 처리했다"}');
  assert.deepEqual(verifyNarrative(["누적 1,200건을 처리했다"], numbers).removed, []);
});

test("지원자가 직접 답한 수치는 근거로 인정한다", () => {
  /* 되묻기 답변은 저장된 근거 행에 없다. 여기서 인정하지 않으면 사용자가
     자기 손으로 적은 숫자가 검증에 걸려 사라진다. */
  const numbers = buildNumberSet('{"readme":"배포 자동화"}', ["배포 시간이 40분에서 5분으로 줄었어요"]);
  assert.deepEqual(verifyNarrative(["배포 시간이 40분에서 5분으로 줄었다"], numbers).removed, []);
});

test("수치가 없는 문장은 그대로 통과한다", () => {
  // impact는 수치가 없어도 된다. 수치를 요구하면 없는 수치를 만들게 된다.
  const numbers = buildNumberSet("{}");
  const sentences = ["N+1 질의를 없애 목록 조회가 한 번의 질의로 끝나게 했다"];
  assert.deepEqual(verifyNarrative(sentences, numbers).value, sentences);
});

test("기술 이름에 붙은 숫자를 수치 주장으로 읽지 않는다", () => {
  /* 'N+1 질의를 없앴다'가 실제로 먼저 걸렸다. 근거에 "1"이 없다는 이유로
     정당한 문장이 통째로 사라졌다. 글자나 기호에 붙은 숫자는 기술 이름이지
     주장이 아니다. */
  const numbers = buildNumberSet('{"readme":"목록 조회를 한 번의 질의로 끝냈다"}');
  const sentences = [
    "N+1 질의를 없애 목록 조회가 한 번의 질의로 끝나게 했다",
    "OAuth 2.0 흐름을 붙였다",
    "S3에 파일을 올리도록 바꿨다",
    "HTTP/2로 옮겼다",
  ];
  assert.deepEqual(verifyNarrative(sentences, numbers).value, sentences);
});

test("단위가 붙은 수치 주장은 그대로 검사한다", () => {
  // 기술 이름을 봐주는 규칙이 정작 잡아야 할 것까지 놓치면 안 된다.
  const numbers = buildNumberSet('{"readme":"배포 자동화"}');
  const result = verifyNarrative(
    ["일 평균 1,200명이 사용했다", "빌드가 3배 빨라졌다", "50% 단축했다"],
    numbers,
  );
  assert.deepEqual(result.value, []);
  assert.equal(result.removed.length, 3);
});
