import assert from "node:assert/strict";
import test from "node:test";

/**
 * "답한 부분만 바뀐다"는 약속을 지키는 자리.
 *
 * 프롬프트에 "다른 곳은 건드리지 마세요"라고 적는 것은 지시일 뿐 강제가 아니다.
 * 모델은 요청하지 않은 자리도 곧잘 돌려준다. 그래서 여기 걸린 단언들이 곧
 * 사용자에게 한 약속이다 — 이게 깨지면 되묻기를 할 이유 자체가 사라진다.
 */

const { applyRewrite } = await import(new URL("../server/portfolio/rewrite.ts", import.meta.url));

const URL_BY_NAME = new Map([
  ["portfolio-api", "https://github.com/example/portfolio-api"],
  ["signal-board", "https://github.com/example/signal-board"],
]);

function content() {
  return {
    profile: {
      displayName: "김지원",
      headline: "문제를 제품으로 번역하는 개발자",
      targetRole: "Backend Engineer",
      avatarUrl: null,
    },
    introduction: "비동기 파이프라인을 다룬 경험이 있습니다.",
    skills: [{ category: "언어", skills: ["TypeScript"] }],
    projects: [
      {
        id: "project-1",
        title: "포트폴리오 생성 API",
        description: "GitHub 근거로 포트폴리오를 만드는 서비스",
        repositoryUrl: "https://github.com/example/portfolio-api",
        role: "프로젝트 개발",
        techStack: ["TypeScript", "Next.js"],
        highlights: ["생성 파이프라인을 단계로 분리"],
        challenges: [],
        solutions: [],
        impact: [],
      },
      {
        id: "project-2",
        title: "신호 보드",
        description: "지표를 모아 보는 대시보드",
        repositoryUrl: "https://github.com/example/signal-board",
        role: "프로젝트 개발",
        techStack: ["React"],
        highlights: [],
        challenges: [],
        solutions: [],
        impact: [],
      },
    ],
    gitAnalysis: {
      summary: "요약",
      primaryLanguage: "TypeScript",
      languages: [{ name: "TypeScript", percentage: 90 }],
      starCount: 1,
      forkCount: 0,
      notablePatterns: ["기능 단위로 PR을 나눔"],
      lastActivityAt: null,
    },
    contact: { githubUrl: "https://github.com/example", email: null, location: null },
  };
}

const rewrite = (overrides = {}) => ({
  repositoryName: "portfolio-api",
  role: "프로젝트 개발",
  highlights: [],
  challenges: [],
  solutions: [],
  impact: [],
  ...overrides,
});

test("답한 자리만 바뀌고 나머지는 참조까지 그대로다", () => {
  const before = content();
  const { content: after, updatedFields } = applyRewrite(
    before,
    [rewrite({ impact: ["배포마다 손으로 확인하던 절차가 없어졌다"] })],
    [{ repositoryName: "portfolio-api", field: "impact" }],
    URL_BY_NAME,
  );

  assert.deepEqual(updatedFields, [{ repositoryName: "portfolio-api", field: "impact" }]);
  assert.deepEqual(after.projects[0].impact, ["배포마다 손으로 확인하던 절차가 없어졌다"]);

  // 손대지 않은 항목은 값이 같은 정도가 아니라 같은 객체여야 한다.
  assert.equal(after.profile, before.profile);
  assert.equal(after.skills, before.skills);
  assert.equal(after.gitAnalysis, before.gitAnalysis);
  assert.equal(after.contact, before.contact);
  assert.equal(after.introduction, before.introduction);
  assert.equal(after.projects[1], before.projects[1]);
  assert.equal(after.projects[0].highlights, before.projects[0].highlights);
});

test("요청하지 않은 자리는 모델이 돌려줘도 버린다", () => {
  /* 이것이 이 함수의 존재 이유다. 응답을 순회하지 않고 답이 있는 자리만
     순회하므로, 모델이 무엇을 더 얹든 들어올 통로가 없다. */
  const before = content();
  const { content: after, updatedFields } = applyRewrite(
    before,
    [rewrite({
      role: "백엔드 리드",
      impact: ["배포 절차가 없어졌다"],
      challenges: ["동시 요청이 몰렸다"],
      solutions: ["큐를 도입했다"],
      highlights: ["새 하이라이트"],
    })],
    [{ repositoryName: "portfolio-api", field: "impact" }],
    URL_BY_NAME,
  );

  assert.deepEqual(updatedFields, [{ repositoryName: "portfolio-api", field: "impact" }]);
  assert.equal(after.projects[0].role, "프로젝트 개발");
  assert.deepEqual(after.projects[0].challenges, []);
  assert.deepEqual(after.projects[0].solutions, []);
  assert.deepEqual(after.projects[0].highlights, ["생성 파이프라인을 단계로 분리"]);
});

test("답하지 않은 프로젝트는 건드리지 않는다", () => {
  const before = content();
  const { content: after } = applyRewrite(
    before,
    [rewrite({ repositoryName: "signal-board", impact: ["지표를 한눈에 보게 됐다"] })],
    [{ repositoryName: "portfolio-api", field: "impact" }],
    URL_BY_NAME,
  );
  assert.equal(after, before, "요청한 자리에 재작성이 없으면 원본이 그대로 나와야 해요");
});

test("빈 값이 기존 문장을 지우지 않는다", () => {
  /* 모델이 빈 배열을 돌려주는 것은 "근거가 없어 못 썼다"는 뜻이다. 그걸
     그대로 반영하면 답변 한 번에 멀쩡하던 항목이 사라진다. */
  const before = content();
  before.projects[0].challenges = ["재시도가 중복 호출을 일으켰다"];

  const { content: after, updatedFields } = applyRewrite(
    before,
    [rewrite({ challenges: [] })],
    [{ repositoryName: "portfolio-api", field: "challenges" }],
    URL_BY_NAME,
  );
  assert.deepEqual(updatedFields, []);
  assert.equal(after, before);
});

test("같은 값을 다시 쓴 것은 바뀐 것으로 세지 않는다", () => {
  // 화면이 "여기가 바뀌었어요"라고 짚었는데 아무 차이가 없으면 신뢰를 잃는다.
  const before = content();
  const { updatedFields } = applyRewrite(
    before,
    [rewrite({ highlights: ["생성 파이프라인을 단계로 분리"] })],
    [{ repositoryName: "portfolio-api", field: "highlights" }],
    URL_BY_NAME,
  );
  assert.deepEqual(updatedFields, []);
});

test("분량 상한을 넘긴 재작성을 잘라 담는다", () => {
  /* 되묻기는 생성 파이프라인 밖이라 runner의 자르기를 타지 않는다. 여기서
     자르지 않으면 답변 한 번으로 문서 레이아웃이 무너진다. */
  const long = "가".repeat(200);
  const { content: after } = applyRewrite(
    content(),
    [rewrite({ impact: [long, long, long, long, long] })],
    [{ repositoryName: "portfolio-api", field: "impact" }],
    URL_BY_NAME,
  );

  assert.equal(after.projects[0].impact.length, 3);
  for (const item of after.projects[0].impact) {
    assert.ok([...item].length <= 90, `항목이 90자를 넘었어요 (${[...item].length}자)`);
  }
});

test("근거에 없는 저장소 이름은 무시한다", () => {
  const before = content();
  const { content: after, updatedFields } = applyRewrite(
    before,
    [rewrite({ repositoryName: "없는-저장소", impact: ["무언가"] })],
    [{ repositoryName: "없는-저장소", field: "impact" }],
    URL_BY_NAME,
  );
  assert.deepEqual(updatedFields, []);
  assert.equal(after, before);
});
