import { connectGitHubAccount } from "@/server/auth/github";
import { createSession, sessionCookie } from "@/server/auth/session";
import { failure, parseCookie, serializeCookie } from "@/server/http";

const OAUTH_STATE_COOKIE_NAME = "github_oauth_state";
const RETURN_TO_COOKIE_NAME = "github_oauth_return_to";

export async function GET(request: Request): Promise<Response> {
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
    const returnTo = parseCookie(request, RETURN_TO_COOKIE_NAME) || "/dashboard";
    const headers = new Headers({ Location: returnTo });
    headers.append("Set-Cookie", sessionCookie(session.token, session.maxAge));
    headers.append("Set-Cookie", serializeCookie(OAUTH_STATE_COOKIE_NAME, "", { maxAge: 0 }));
    headers.append("Set-Cookie", serializeCookie(RETURN_TO_COOKIE_NAME, "", { maxAge: 0 }));
    return new Response(null, { status: 302, headers });
  } catch {
    return failure("AUTH_FAILED", "GitHub 로그인에 실패했습니다.", 401);
  }
}
