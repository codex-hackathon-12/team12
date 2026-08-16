import { requireUser } from "@/server/auth/require-user";
import { failure, success } from "@/server/http";
import { getRepository } from "@/server/github/repositories";
import { withApiLogging } from "@/server/observability/api-logging";

async function handleGET(
  request: Request,
  context: { params: Promise<{ repositoryId: string }> },
): Promise<Response> {
  const authentication = await requireUser(request);
  if ("response" in authentication) {
    return authentication.response;
  }

  const { repositoryId } = await context.params;
  const repository = await getRepository(authentication.user.id, repositoryId);
  if (!repository) {
    return failure("NOT_FOUND", "저장소를 찾을 수 없습니다.", 404);
  }

  return success(repository);
}

export const GET = withApiLogging(
  { domain: "repositories", operation: "repository.read", route: "/api/v1/repositories/[repositoryId]" },
  handleGET,
);
