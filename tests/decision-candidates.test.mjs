import assert from "node:assert/strict";
import test from "node:test";

/**
 * 저장소에서 찾은 결정 후보.
 *
 * 초안이 결정을 고르는 일은 모델이 하는데, 무엇이 말할 만한 결정인지는 만든
 * 사람이 안다. 여기서는 판단하지 않고 저장소에 실제로 남아 있는 것을 그대로
 * 내민다. 여기 걸린 것은 목록이 훑을 만한지를 지킨다 — 병합 커밋이 섞이면
 * 진짜 후보가 묻히고, 다듬어 고쳐 쓰면 본인이 못 알아본다.
 */

const { selectDecisionCandidates, MAX_DECISION_CANDIDATES } = await import(
  new URL("../server/portfolio/decision-candidates.ts", import.meta.url)
);

const repository = (overrides = {}) => ({
  ownPullRequests: [],
  ownCommits: [],
  ...overrides,
});

test("본문이 있는 것이 앞에 온다", () => {
  /* 본문은 "왜"가 적히는 자리다. 지원자가 설명하기 쉽고, 애초에 본문을 쓸
     만큼 판단이 있었던 변경이라는 뜻이기도 하다. */
  const found = selectDecisionCandidates(repository({
    ownPullRequests: [{ title: "재시도 예산을 저장소마다 나눔", merged: true, body: "" }],
    ownCommits: [{ title: "생성 흐름을 세 단계로 나눔", body: "저장에서 실패하면 통째로 다시 돌았다." }],
  }));
  assert.equal(found[0].topic, "생성 흐름을 세 단계로 나눔");
  assert.equal(found[0].hasContext, true);
  assert.equal(found[1].source, "pullRequest");
});

test("제목을 다듬지 않는다", () => {
  /* topic은 "지원자가 '아, 그거' 하고 떠올릴 수 있는 것"이라야 한다.
     매끄럽게 고쳐 쓰면 오히려 못 알아본다. */
  const title = "fix: N+1 질의를 없애 목록 조회를 한 번으로";
  const [found] = selectDecisionCandidates(repository({
    ownCommits: [{ title, body: "목록마다 40여 회씩 나갔다." }],
  }));
  assert.equal(found.topic, title);
});

test("결정이 아닌 것을 걸러낸다", () => {
  const found = selectDecisionCandidates(repository({
    ownCommits: [
      { title: "Merge branch 'main' into feature/login", body: "" },
      { title: "chore: bump dependencies", body: "" },
      { title: "typo", body: "" },
      { title: "v1.2.0", body: "" },
      { title: "Revert \"세 단계로 나눔\"", body: "" },
      { title: "알림을 서버 폴링에서 로컬 푸시로 옮김", body: "" },
    ],
  }));
  assert.deepEqual(found.map((item) => item.topic), ["알림을 서버 폴링에서 로컬 푸시로 옮김"]);
});

test("같은 제목을 두 번 내밀지 않는다", () => {
  /* PR과 그 안의 커밋이 같은 제목을 갖는 일이 흔하다. */
  const title = "시술 기록 동기화를 큐로 옮김";
  const found = selectDecisionCandidates(repository({
    ownPullRequests: [{ title, merged: true, body: "" }],
    ownCommits: [{ title, body: "" }],
  }));
  assert.equal(found.length, 1);
});

test("고르는 일이 일이 되지 않게 끊는다", () => {
  const found = selectDecisionCandidates(repository({
    ownCommits: Array.from({ length: 20 }, (_, index) => ({
      title: `기능 ${index}번을 다른 방식으로 바꿈`,
      body: "",
    })),
  }));
  assert.equal(found.length, MAX_DECISION_CANDIDATES);
});

test("같은 순위 안에서는 순서가 흔들리지 않는다", () => {
  /* 두 번 열었는데 목록이 다르면 방금 본 것을 다시 찾게 된다. */
  const input = repository({
    ownCommits: [
      { title: "알림을 로컬 푸시로 옮김", body: "" },
      { title: "동기화를 큐로 옮김", body: "" },
      { title: "세션 저장을 쿠키로 바꿈", body: "" },
    ],
  });
  assert.deepEqual(
    selectDecisionCandidates(input).map((item) => item.topic),
    selectDecisionCandidates(input).map((item) => item.topic),
  );
  assert.equal(selectDecisionCandidates(input)[0].topic, "알림을 로컬 푸시로 옮김");
});

test("근거가 비어도 터지지 않는다", () => {
  assert.deepEqual(selectDecisionCandidates({}), []);
});
