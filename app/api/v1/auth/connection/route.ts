import { getGitHubConnection } from "@/server/auth/github";
import { requireUser } from "@/server/auth/require-user";
import { failure, success } from "@/server/http";
import { withApiLogging } from "@/server/observability/api-logging";

async function handleGET(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if ("response" in auth) {
    return auth.response;
  }

  const connection = await getGitHubConnection(auth.user);
  if (!connection) {
    return failure(
      "GITHUB_CONNECTION_ERROR",
      "GitHub 연동 정보를 찾을 수 없습니다. 다시 로그인해주세요.",
      404,
    );
  }

  return success(connection);
}

export const GET = withApiLogging(
  { domain: "auth", operation: "connection.read", route: "/api/v1/auth/connection" },
  handleGET,
);
