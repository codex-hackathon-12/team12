import { getSessionUser } from "@/server/auth/session";
import { success } from "@/server/http";

export async function GET(request: Request): Promise<Response> {
  const user = await getSessionUser(request);
  return success({
    authenticated: Boolean(user),
    provider: user ? "github" : null,
    user: user
      ? {
          id: user.id,
          githubUserId: user.githubUserId,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          profileUrl: user.profileUrl,
          email: user.email,
          creditBalance: 100,
          createdAt: user.createdAt,
        }
      : null,
  });
}
