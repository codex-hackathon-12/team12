import { requireUser } from "@/server/auth/require-user";
import { failure, success } from "@/server/http";
import { GitHubApiError, syncRepositories } from "@/server/github/repositories";
import { getRequestId, logOperationFailure, withApiLogging } from "@/server/observability/api-logging";

/**
 * 이 라우트는 GitHub을 여러 번 순차로 부르므로 기본 실행 시간으로는 모자란다.
 * 예산을 밝혀 두면 서버 쪽 SYNC_BUDGET_MS와 함께 읽힌다 — 그쪽이 먼저 끝나
 * 부분 결과라도 돌려주고, 이 값은 그것을 담을 여유다.
 */
export const maxDuration = 60;

async function handlePOST(request: Request): Promise<Response> {
  const authentication = await requireUser(request);
  if ("response" in authentication) {
    return authentication.response;
  }

  try {
    const repositories = await syncRepositories(authentication.user.id);
    return success({ repositories, syncedAt: new Date().toISOString() });
  } catch (error) {
    logOperationFailure({
      domain: "repositories",
      operation: "repository.sync",
      requestId: getRequestId(request),
      error,
    });
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

export const POST = withApiLogging(
  { domain: "repositories", operation: "repository.sync", route: "/api/v1/repositories/sync" },
  handlePOST,
);
