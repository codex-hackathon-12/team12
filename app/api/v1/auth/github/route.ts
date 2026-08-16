import { getGitHubAuthorizationUrl } from "@/server/auth/github";
import { randomToken } from "@/server/auth/crypto";
import { isSafeReturnPath, serializeCookie } from "@/server/http";

const OAUTH_STATE_COOKIE_NAME = "github_oauth_state";
const RETURN_TO_COOKIE_NAME = "github_oauth_return_to";

export async function GET(request: Request): Promise<Response> {
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
