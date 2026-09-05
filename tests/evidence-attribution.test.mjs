import assert from "node:assert/strict";
import test from "node:test";

const { isOwnEmail, bodyOf, parseManifest } = await import(
  new URL("../server/github/evidence-parsing.ts", import.meta.url)
);

/**
 * 근거 수집에서 판단이 갈리는 세 지점.
 *
 * 특히 본인 판정은 틀리는 방향이 중요하다. 못 찾는 것은 근거가 얇아질 뿐이지만,
 * 잘못 찾으면 남의 작업이 지원자의 성과가 된다. 후자가 훨씬 큰 사고다.
 */

test("커밋 저자를 확실한 신호로만 본인이라고 본다", () => {
  const login = "octocat";
  const email = "octo@example.com";

  // GitHub 프로필에 등록된 대표 이메일
  assert.equal(isOwnEmail(login, email, "octo@example.com"), true);
  assert.equal(isOwnEmail(login, email, "OCTO@Example.com"), true, "대소문자는 같은 주소다");

  // GitHub이 발급하는 noreply 주소 두 형태
  assert.equal(isOwnEmail(login, email, "octocat@users.noreply.github.com"), true);
  assert.equal(isOwnEmail(login, email, "12345+octocat@users.noreply.github.com"), true);
});

test("애매하면 본인으로 보지 않는다", () => {
  const login = "octocat";
  const email = "octo@example.com";

  assert.equal(isOwnEmail(login, email, "someone@example.com"), false);
  assert.equal(isOwnEmail(login, email, ""), false);
  assert.equal(isOwnEmail(login, email, null), false);
  assert.equal(isOwnEmail(login, email, undefined), false);

  /* 다른 사람의 noreply 주소. login이 부분 문자열로 들어가도 안 된다 —
     여기서 느슨해지면 남의 커밋이 지원자의 성과가 된다. */
  assert.equal(isOwnEmail(login, email, "octocat2@users.noreply.github.com"), false);
  assert.equal(isOwnEmail(login, email, "notoctocat@users.noreply.github.com"), false);
  assert.equal(isOwnEmail(login, email, "octocat@users.noreply.github.com.evil.test"), false);

  // 로그인도 이메일도 모르면 판단할 근거가 없다.
  assert.equal(isOwnEmail("", "", "anything@example.com"), false);
});

test("커밋 본문에서 이유만 남긴다", () => {
  const message = [
    "fix: 폴링이 멈춘 작업을 영원히 기다리던 것을 고친다",
    "",
    "서버가 정리해줄 때까지 화면이 계속 물어봤다.",
    "15분이 지나면 포기하고 대시보드로 안내한다.",
    "",
    "Co-authored-by: Someone <someone@example.com>",
    "Signed-off-by: Someone <someone@example.com>",
  ].join("\n");

  const body = bodyOf(message);
  assert.ok(body.includes("서버가 정리해줄 때까지"), "이유가 남아야 해요");
  assert.ok(body.includes("15분이 지나면"), "본문 둘째 줄도 남아야 해요");
  // 자동 생성 꼬리표는 근거가 아니라 잡음이다.
  assert.ok(!body.includes("Co-authored-by"), "꼬리표가 남았어요");
  assert.ok(!body.includes("Signed-off-by"), "꼬리표가 남았어요");
  assert.ok(!body.startsWith("fix:"), "제목이 본문에 섞였어요");

  // 본문 없는 커밋은 빈 문자열이다. 제목으로 이유를 지어내면 안 된다.
  assert.equal(bodyOf("chore: 의존성 올림"), "");
  assert.equal(bodyOf(undefined), "");
});

test("의존성 목록을 매니페스트에서 읽는다", () => {
  const packageJson = JSON.stringify({
    name: "app",
    dependencies: { react: "^19.0.0", next: "16.0.0" },
    devDependencies: { typescript: "^5.9.0" },
    scripts: { build: "next build" },
  });
  const names = parseManifest("package.json", packageJson);
  assert.deepEqual(names.sort(), ["next", "react", "typescript"]);
  assert.ok(!names.includes("build"), "scripts를 의존성으로 읽었어요");

  // 깨진 파일은 근거 없음으로 둔다. 추측해서 채우지 않는다.
  assert.deepEqual(parseManifest("package.json", "{ not json"), []);

  const requirements = [
    "# 주석은 무시",
    "django>=4.2",
    "requests==2.31.0",
    "pytest",
    "-r other.txt",
    "",
  ].join("\n");
  assert.deepEqual(parseManifest("requirements.txt", requirements), ["django", "requests", "pytest"]);
});

/**
 * diff와 기여 기간.
 *
 * 질문이 포괄적이던 근본 원인은 근거가 얕아서였다. 코드를 한 줄도 안 읽으면
 * "이 프로젝트로 무엇이 달라졌나요?"처럼 저장소를 안 봐도 물을 수 있는 질문만
 * 나온다. 여기 걸린 것은 diff를 읽되 잡음에 예산을 뺏기지 않게 하는 규칙이다.
 */

const { isNoisyPath, formatPeriod, lastPageOf } = await import(
  new URL("../server/github/evidence-parsing.ts", import.meta.url)
);

test("사람이 쓰지 않은 파일은 diff에서 걸러낸다", () => {
  /* 잠금 파일 하나가 수천 줄이라 그대로 실으면 근거 예산을 통째로 먹고,
     정작 본인이 쓴 코드가 밀려난다. */
  for (const path of [
    "package-lock.json",
    "web/yarn.lock",
    "pnpm-lock.yaml",
    "dist/main.js",
    "app/build/output.css",
    "vendor/lib.js",
    "public/logo.svg",
    "styles/app.min.css",
    "__snapshots__/view.snap",
  ]) {
    assert.ok(isNoisyPath(path), `${path}를 걸러내지 못했어요`);
  }
});

test("사람이 쓴 코드는 남긴다", () => {
  // 너무 넓게 거르면 정작 볼 것이 남지 않는다.
  for (const path of [
    "server/portfolio/rewrite.ts",
    "app/api/v1/generations/route.ts",
    "package.json",
    "src/build-config.ts",
    "lib/distance.ts",
  ]) {
    assert.ok(!isNoisyPath(path), `${path}를 잘못 걸러냈어요`);
  }
});

test("기여 기간을 읽기 쉬운 한 줄로 만든다", () => {
  assert.equal(formatPeriod("2026-03-04T00:00:00Z", "2026-06-20T00:00:00Z"), "2026.03–06");
  // 같은 달이면 한 번만 쓴다.
  assert.equal(formatPeriod("2026-03-04T00:00:00Z", "2026-03-28T00:00:00Z"), "2026.03");
  // 해를 넘기면 뒤쪽 연도를 살린다.
  assert.equal(formatPeriod("2025-11-04T00:00:00Z", "2026-02-20T00:00:00Z"), "2025.11–2026.02");
});

test("기간을 계산할 수 없으면 지어내지 않는다", () => {
  /* 화면은 null이면 그 칸을 아예 그리지 않는다. 빈 문자열이나 오늘 날짜로
     때우면 사실이 아닌 값이 문서에 박힌다. */
  assert.equal(formatPeriod(null, null), null);
  assert.equal(formatPeriod("", "2026-06-20T00:00:00Z"), null);
  assert.equal(formatPeriod("말이 안 되는 값", null), null);
  // 끝을 모르면 시작만 쓴다.
  assert.equal(formatPeriod("2026-03-04T00:00:00Z", null), "2026.03");
});

test("마지막 페이지가 있을 때만 한 번 더 부른다", () => {
  const header = '<https://api.github.com/repositories/1/commits?per_page=20&page=2>; rel="next", '
    + '<https://api.github.com/repositories/1/commits?per_page=20&page=7>; rel="last"';
  assert.equal(lastPageOf(header), 7);

  // 한 페이지에 다 들어가면 헤더가 없고, 이미 받은 목록의 끝이 최초 커밋이다.
  assert.equal(lastPageOf(null), null);
  assert.equal(lastPageOf('<https://api.github.com/x?page=1>; rel="last"'), null);
});
