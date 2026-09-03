import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * 로그인 시작 라우트가 미리 당겨지지 않게 지킨다.
 *
 * 이 라우트는 호출될 때마다 OAuth state를 새로 굽는다. 화면이 이 주소를
 * `<Link>`로 가리키면 Next가 프리페치하고, 그 한 번마다 쿠키가 갈아엎힌다.
 * 사용자가 버튼을 누른 뒤 늦게 도착한 프리페치가 쿠키를 덮으면 GitHub이
 * 돌려준 state와 어긋나 로그인이 실패한다 — 운영 콘솔에 GitHub으로 나가는
 * CORS 실패가 찍혀 있던 것이 그 프리페치였다.
 *
 * 실패가 간헐적이라 사람이 재현하기 어렵다. 두 겹으로 막고 둘 다 지킨다.
 */

const root = new URL("..", import.meta.url).pathname;
const read = (path) => readFileSync(root + path, "utf8");

test("로그인 시작 링크는 <a>여야 한다", () => {
  /* <Link>는 앱 안의 화면 이동용이다. 이 주소는 서버 라우트이고 GitHub으로
     나가므로 클라이언트 라우팅 대상이 아니다. */
  const offenders = [];
  for (const path of ["app/page.tsx", "app/(dashboard)/settings/page.tsx"]) {
    const text = read(path);
    for (const [, tag] of text.matchAll(/<(\w+)[^>]*href=\{(?:loginHref|reauthorizeHref)\}/gu)) {
      if (tag !== "a") offenders.push(`${path}: <${tag}>`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `로그인 시작 주소를 <a>가 아닌 것으로 가리키고 있어요:\n${offenders.join("\n")}`,
  );
});

test("프리페치에는 state를 발급하지 않는다", () => {
  /* 링크를 고쳐도 다음에 누가 다시 <Link>로 적을 수 있다. 굽는 쪽에서도 막는다. */
  const route = read("app/api/v1/auth/github/route.ts");
  assert.match(route, /next-router-prefetch/u, "Next 프리페치 헤더를 안 보고 있어요");
  assert.match(route, /sec-purpose/u, "표준 프리페치 헤더를 안 보고 있어요");
  /* state를 만들기 *전에* 빠져나가야 한다. 뒤에 두면 쿠키가 이미 구워진다. */
  const guard = route.indexOf("isPrefetch(request)");
  const mint = route.indexOf("randomToken()", route.indexOf("async function handleGET"));
  assert.ok(guard !== -1, "프리페치 가드가 없어요");
  assert.ok(guard < mint, "프리페치 가드가 state 발급보다 뒤에 있어요");
});
