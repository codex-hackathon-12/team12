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
