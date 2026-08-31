import { getSessionUser, type AuthenticatedUser } from "@/server/auth/session";
import { failure } from "@/server/http";
import { setLogUser } from "@/server/observability/api-logging";

export async function requireUser(
  request: Request,
): Promise<{ user: AuthenticatedUser } | { response: Response }> {
  const user = await getSessionUser(request);
  if (!user) {
    return { response: failure("AUTH_REQUIRED", "로그인이 필요합니다.", 401) };
  }
  // 인증을 지나는 모든 라우트가 여기를 거치므로 한 번만 걸어두면 된다.
  setLogUser(request, user.id);
  return { user };
}
