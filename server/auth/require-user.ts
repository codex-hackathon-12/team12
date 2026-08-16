import { getSessionUser, type AuthenticatedUser } from "@/server/auth/session";
import { failure } from "@/server/http";

export async function requireUser(
  request: Request,
): Promise<{ user: AuthenticatedUser } | { response: Response }> {
  const user = await getSessionUser(request);
  if (!user) {
    return { response: failure("AUTH_REQUIRED", "로그인이 필요합니다.", 401) };
  }
  return { user };
}
