import { requireUser } from "@/server/auth/require-user";
import { failure, success } from "@/server/http";
import { decodeCursor, encodeCursor, listRepositories } from "@/server/github/repositories";
import { withApiLogging } from "@/server/observability/api-logging";

async function handleGET(request: Request): Promise<Response> {
  const authentication = await requireUser(request);
  if ("response" in authentication) {
    return authentication.response;
  }

  const url = new URL(request.url);
  const visibility = url.searchParams.get("visibility") ?? "all";
  if (!["all", "public", "private"].includes(visibility)) {
    return failure("VALIDATION_ERROR", "visibility 값이 올바르지 않습니다.", 400);
  }

  const requestedLimit = Number(url.searchParams.get("limit") ?? "20");
  const limit = Number.isInteger(requestedLimit) && requestedLimit >= 1 && requestedLimit <= 50 ? requestedLimit : 20;
  const result = await listRepositories(authentication.user.id, {
    q: url.searchParams.get("q") ?? undefined,
    visibility: visibility as "all" | "public" | "private",
    limit,
    offset: decodeCursor(url.searchParams.get("cursor")),
  });

  return success(
    { repositories: result.repositories },
    200,
    { nextCursor: encodeCursor(result.nextOffset), hasNextPage: result.hasNextPage },
  );
}

export const GET = withApiLogging(
  { domain: "repositories", operation: "repository.list", route: "/api/v1/repositories" },
  handleGET,
);
