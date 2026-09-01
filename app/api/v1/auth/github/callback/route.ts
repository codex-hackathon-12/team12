import { connectGitHubAccount } from "@/server/auth/github";
import { createSession, sessionCookie } from "@/server/auth/session";
import { isSafeReturnPath, parseCookie, serializeCookie } from "@/server/http";
import { getRequestId, logOperationFailure, withApiLogging } from "@/server/observability/api-logging";

const OAUTH_STATE_COOKIE_NAME = "github_oauth_state";
const RETURN_TO_COOKIE_NAME = "github_oauth_return_to";

/** 로그인 화면에서 사정을 설명할 수 있게 사유를 붙여 돌려보낸다. */
export type AuthFailureReason = "state_expired" | "denied" | "failed";

function clearOAuthCookies(headers: Headers): void {
  headers.append("Set-Cookie", serializeCookie(OAUTH_STATE_COOKIE_NAME, "", { maxAge: 0 }));
  headers.append("Set-Cookie", serializeCookie(RETURN_TO_COOKIE_NAME, "", { maxAge: 0 }));
}

/**
 * 실패를 랜딩으로 돌려보낸다.
 *
 * 예전에는 JSON 본문을 그대로 브라우저에 뿌렸다. 사용자는 링크도 돌아갈 길도 없는
 * `{"error":{...}}` 화면 앞에 남았고, 그 흔한 경우가 state 쿠키 10분 만료였다.
 */
function redirectToLanding(reason: AuthFailureReason): Response {
  const headers = new Headers({ Location: `/?auth=${reason}` });
  clearOAuthCookies(headers);
  return new Response(null, { status: 302, headers });
}

async function handleGET(request: Request): Promise<Response> {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const savedState = parseCookie(request, OAUTH_STATE_COOKIE_NAME);

  // 사용자가 GitHub 화면에서 취소한 경우. 실패가 아니라 선택이므로 문구가 달라야 한다.
  if (requestUrl.searchParams.get("error")) {
    return redirectToLanding("denied");
  }

  /* code나 state가 없거나 어긋난다. 대부분은 공격이 아니라 로그인 창을 오래 열어둬
     state 쿠키(10분)가 사라진 경우다. 그에 맞는 문구를 쓴다. */
  if (!code || !state || !savedState || state !== savedState) {
    return redirectToLanding("state_expired");
  }

  try {
    const userId = await connectGitHubAccount(code);
    const session = await createSession(userId);
    /* 쿠키는 우리가 심었지만 그대로 믿고 리다이렉트하면 안 된다. 검증은
       심을 때와 쓸 때 양쪽에서 한다. */
    const savedReturnTo = parseCookie(request, RETURN_TO_COOKIE_NAME);
    const returnTo = isSafeReturnPath(savedReturnTo) ? savedReturnTo : "/dashboard";
    const headers = new Headers({ Location: returnTo });
    headers.append("Set-Cookie", sessionCookie(session.token, session.maxAge));
    clearOAuthCookies(headers);
    return new Response(null, { status: 302, headers });
  } catch (error) {
    logOperationFailure({
      domain: "auth",
      operation: "github.callback",
      requestId: getRequestId(request),
      error,
    });
    return redirectToLanding("failed");
  }
}

export const GET = withApiLogging(
  { domain: "auth", operation: "github.callback", route: "/api/v1/auth/github/callback" },
  handleGET,
);
