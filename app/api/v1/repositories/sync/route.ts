import { requireUser } from "@/server/auth/require-user";
import { failure, success } from "@/server/http";
import { GitHubApiError, syncRepositories } from "@/server/github/repositories";

export async function POST(request: Request): Promise<Response> {
  const authentication = await requireUser(request);
  if ("response" in authentication) {
    return authentication.response;
  }

  try {
    const repositories = await syncRepositories(authentication.user.id);
    return success({ repositories, syncedAt: new Date().toISOString() });
  } catch (error) {
    if (error instanceof GitHubApiError) {
      return failure(
        error.kind === "rate_limited" ? "GITHUB_RATE_LIMITED" : "GITHUB_CONNECTION_ERROR",
        error.kind === "rate_limited" ? "GitHub API 호출 한도를 초과했습니다." : "GitHub 저장소를 불러오지 못했습니다.",
        error.kind === "rate_limited" ? 429 : 502,
      );
    }
    return failure("INTERNAL_ERROR", "저장소 동기화에 실패했습니다.", 500);
  }
}
