import assert from "node:assert/strict";
import test from "node:test";

const { isSafeReturnPath } = await import(new URL("../server/http.ts", import.meta.url));

test("서비스 내부 경로만 허용한다", () => {
  assert.equal(isSafeReturnPath("/dashboard"), true);
  assert.equal(isSafeReturnPath("/portfolios/abc?tab=share"), true);
});

test("외부로 나가는 값은 막는다", () => {
  assert.equal(isSafeReturnPath("https://evil.com"), false);
  assert.equal(isSafeReturnPath("//evil.com"), false);
  // 브라우저가 백슬래시를 슬래시로 정규화해 //evil.com이 된다.
  assert.equal(isSafeReturnPath("/\\evil.com"), false);
  assert.equal(isSafeReturnPath("/\\/evil.com"), false);
});

test("빈 값과 제어문자를 막는다", () => {
  assert.equal(isSafeReturnPath(null), false);
  assert.equal(isSafeReturnPath(""), false);
  assert.equal(isSafeReturnPath("/dash\nboard"), false);
});
