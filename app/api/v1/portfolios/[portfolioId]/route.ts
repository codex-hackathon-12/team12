import { requireUser } from "@/server/auth/require-user";
import { failure, success } from "@/server/http";
import { withApiLogging } from "@/server/observability/api-logging";
import { deletePortfolio, getPortfolio } from "@/server/portfolio/portfolios";

async function handleGET(
  request: Request,
  context: { params: Promise<{ portfolioId: string }> },
): Promise<Response> {
  const authentication = await requireUser(request);
  if ("response" in authentication) {
    return authentication.response;
  }

  const { portfolioId } = await context.params;
  const portfolio = await getPortfolio(authentication.user.id, portfolioId);
  if (!portfolio) {
    return failure("NOT_FOUND", "포트폴리오를 찾을 수 없습니다.", 404);
  }

  return success(portfolio);
}

async function handleDELETE(
  request: Request,
  context: { params: Promise<{ portfolioId: string }> },
): Promise<Response> {
  const authentication = await requireUser(request);
  if ("response" in authentication) {
    return authentication.response;
  }

  const { portfolioId } = await context.params;
  const deleted = await deletePortfolio(authentication.user.id, portfolioId);
  if (!deleted) {
    return failure("NOT_FOUND", "포트폴리오를 찾을 수 없습니다.", 404);
  }

  return success({ deletedId: portfolioId });
}

export const GET = withApiLogging(
  { domain: "portfolios", operation: "portfolio.read", route: "/api/v1/portfolios/[portfolioId]" },
  handleGET,
);

export const DELETE = withApiLogging(
  { domain: "portfolios", operation: "portfolio.delete", route: "/api/v1/portfolios/[portfolioId]" },
  handleDELETE,
);
