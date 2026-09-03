import { getGitHubAuthorizationUrl } from "@/server/auth/github";
import { randomToken } from "@/server/auth/crypto";
import { isSafeReturnPath, serializeCookie } from "@/server/http";
import { withApiLogging } from "@/server/observability/api-logging";

const OAUTH_STATE_COOKIE_NAME = "github_oauth_state";
const RETURN_TO_COOKIE_NAME = "github_oauth_return_to";

/**
 * 프리페치인지 본다.
 *
 * 이 라우트는 호출될 때마다 OAuth state를 새로 굽는다. 화면이 이 주소를
 * <Link>로 가리키면 Next가 미리 당겨오고, 그 한 번마다 쿠키가 갈아엎힌다.
 * 사용자가 버튼을 누른 뒤 늦게 도착한 프리페치가 쿠키를 덮으면 GitHub이
 * 돌려준 state와 어긋나 로그인이 실패한다.
 *
 * 링크를 <a>로 바꿔 원인은 없앴지만, 다음에 누가 다시 <Link>로 적을 수 있다.
 * state를 굽는 쪽에서도 막는다.
 */
function isPrefetch(request: Request): boolean {
  return (
    request.headers.get("next-router-prefetch") !== null ||
    request.headers.get("purpose") === "prefetch" ||
    request.headers.get("sec-purpose")?.includes("prefetch") === true
  );
}

async function handleGET(request: Request): Promise<Response> {
  /* 미리 당겨오는 요청에는 아무것도 내주지 않는다. 실제로 누를 때 발급한다. */
  if (isPrefetch(request)) {
    return new Response(null, { status: 204 });
  }

  const requestUrl = new URL(request.url);
  const returnTo = requestUrl.searchParams.get("returnTo");
  const state = randomToken();
  const headers = new Headers({ Location: getGitHubAuthorizationUrl(state) });
  headers.append("Set-Cookie", serializeCookie(OAUTH_STATE_COOKIE_NAME, state, { maxAge: 600 }));
  headers.append(
    "Set-Cookie",
    serializeCookie(RETURN_TO_COOKIE_NAME, isSafeReturnPath(returnTo) ? returnTo : "/dashboard", { maxAge: 600 }),
  );
  return new Response(null, { status: 302, headers });
}

export const GET = withApiLogging(
  { domain: "auth", operation: "github.authorize", route: "/api/v1/auth/github" },
  handleGET,
);
