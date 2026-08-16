import { requireUser } from "@/server/auth/require-user";
import { failure, success } from "@/server/http";
import { withApiLogging } from "@/server/observability/api-logging";
import { getPortfolio } from "@/server/portfolio/portfolios";

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

export const GET = withApiLogging(
  { domain: "portfolios", operation: "portfolio.read", route: "/api/v1/portfolios/[portfolioId]" },
  handleGET,
);
