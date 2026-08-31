import { connectGitHubAccount } from "@/server/auth/github";
import { createSession, sessionCookie } from "@/server/auth/session";
import { failure, isSafeReturnPath, parseCookie, serializeCookie } from "@/server/http";
import { getRequestId, logOperationFailure, withApiLogging } from "@/server/observability/api-logging";

const OAUTH_STATE_COOKIE_NAME = "github_oauth_state";
const RETURN_TO_COOKIE_NAME = "github_oauth_return_to";

async function handleGET(request: Request): Promise<Response> {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const savedState = parseCookie(request, OAUTH_STATE_COOKIE_NAME);

  if (!code || !state || !savedState || state !== savedState) {
    return failure("AUTH_FAILED", "GitHub 로그인 검증에 실패했습니다.", 401);
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
    headers.append("Set-Cookie", serializeCookie(OAUTH_STATE_COOKIE_NAME, "", { maxAge: 0 }));
    headers.append("Set-Cookie", serializeCookie(RETURN_TO_COOKIE_NAME, "", { maxAge: 0 }));
    return new Response(null, { status: 302, headers });
  } catch (error) {
    logOperationFailure({
      domain: "auth",
      operation: "github.callback",
      requestId: getRequestId(request),
      error,
    });
    return failure("AUTH_FAILED", "GitHub 로그인에 실패했습니다.", 401);
  }
}

export const GET = withApiLogging(
  { domain: "auth", operation: "github.callback", route: "/api/v1/auth/github/callback" },
  handleGET,
);
