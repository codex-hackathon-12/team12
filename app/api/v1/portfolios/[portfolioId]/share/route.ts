import { requireUser } from "@/server/auth/require-user";
import { failure, getBaseUrl, success } from "@/server/http";
import { withApiLogging } from "@/server/observability/api-logging";
import { updatePortfolioShare } from "@/server/portfolio/portfolios";

async function handlePUT(
  request: Request,
  context: { params: Promise<{ portfolioId: string }> },
): Promise<Response> {
  const authentication = await requireUser(request);
  if ("response" in authentication) {
    return authentication.response;
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return failure("VALIDATION_ERROR", "요청 본문이 올바르지 않습니다.", 400);
  }

  if (typeof body.published !== "boolean") {
    return failure("VALIDATION_ERROR", "published 값이 올바르지 않습니다.", 400);
  }

  const { portfolioId } = await context.params;
  const share = await updatePortfolioShare(
    authentication.user.id,
    portfolioId,
    body.published,
    getBaseUrl(request),
  );

  if (!share) {
    return failure("NOT_FOUND", "포트폴리오를 찾을 수 없습니다.", 404);
  }

  return success(share);
}

export const PUT = withApiLogging(
  { domain: "portfolios", operation: "portfolio.share", route: "/api/v1/portfolios/[portfolioId]/share" },
  handlePUT,
);
