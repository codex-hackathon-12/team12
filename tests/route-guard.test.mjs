import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * 로그인 라우팅 가드.
 *
 * 갤러리(결과물 먼저 보기)는 공개인데 대시보드 셸 안에 있어, 로그아웃
 * 상태에서 내비게이션을 누르면 대시보드는 빈 화면이 자기 것처럼 열렸고
 * 나머지는 API 401이 예고 없이 GitHub OAuth로 튕겼다. 여기 걸린 것은 그
 * 구멍이 다시 열리는 것을 막는다.
 */

const root = new URL("..", import.meta.url).pathname;
const read = (path) => readFileSync(root + path, "utf8");

const middleware = read("middleware.ts");

test("보호 경로를 전부 덮고 공개 경로는 건드리지 않는다", () => {
  for (const path of ["/dashboard", "/portfolios", "/repositories", "/create", "/billing", "/settings"]) {
    assert.match(middleware, new RegExp(`"${path}/:path\\*"`, "u"), `${path}가 가드 밖이에요`);
  }
  /* 결과물 먼저 보기·공개 링크·소식은 로그인 없이 열리는 것이 존재 이유다. */
  for (const path of ["/gallery", "/p/", "/announcements"]) {
    assert.ok(!middleware.includes(`"${path}`), `${path}까지 막았어요`);
  }
});

test("쿠키 이름은 잎 모듈이 단일 출처다", () => {
  /* 이름을 두 곳에 적으면 쿠키 이름을 바꿀 때 가드만 조용히 죽는다. 그리고
     session.ts는 supabase를 끌고 와서 미들웨어(edge 번들)가 import하면 안
     된다 — 잎 모듈이어야 한다. */
  assert.match(middleware, /import \{ SESSION_COOKIE_NAME \} from "@\/server\/auth\/cookie"/u);
  assert.doesNotMatch(middleware, /"portfolio_session"/u, "이름을 다시 적었어요");

  const leaf = read("server/auth/cookie.ts");
  assert.doesNotMatch(leaf, /^import/mu, "잎 모듈이 무언가를 끌고 와요");

  const session = read("server/auth/session.ts");
  assert.match(session, /export \{ SESSION_COOKIE_NAME \} from "@\/server\/auth\/cookie"/u,
    "기존 이름 출처가 잎을 가리키지 않아요");
});

test("목 모드는 가드를 지나간다", () => {
  /* 목 모드는 세션 쿠키가 없는 게 정상이다. 로컬 개발과 e2e가 전부 목으로
     도는데 여기서 막으면 아무 화면도 못 들어간다. */
  assert.match(middleware, /NEXT_PUBLIC_API_MODE !== "http"/u, "목 모드 우회가 없어요");
});

test("돌려보낼 때 보던 화면을 실어 보낸다", () => {
  assert.match(middleware, /searchParams\.set\("returnTo"/u, "로그인 뒤 돌아갈 길이 없어요");
});

test("랜딩이 returnTo를 검증해서 쓴다", () => {
  /* 아무 값이나 통과시키면 로그인 흐름이 열린 리다이렉트가 된다 — 피싱
     사이트가 자기 주소를 실어 보낼 수 있다. 콜백 라우트와 같은 판정을 쓴다. */
  const landing = read("app/page.tsx");
  assert.match(landing, /isSafeReturnPath\(rawReturnTo\)/u, "검증 없이 써요");
  assert.match(landing, /getGitHubLoginUrl\(returnTo\)/u, "로그인 뒤 보던 화면으로 안 돌아가요");
  // 왜 랜딩에 서 있는지 말해준다. 아무 말 없으면 링크가 고장난 것처럼 보인다.
  assert.match(landing, /로그인이 필요한 화면이에요/u);

  const callback = read("app/api/v1/auth/github/callback/route.ts");
  assert.match(callback, /isSafeReturnPath/u, "콜백이 다른 판정을 써요");
});
