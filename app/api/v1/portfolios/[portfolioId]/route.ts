import { requireUser } from "@/server/auth/require-user";
import { failure, getBaseUrl, success } from "@/server/http";
import { withApiLogging } from "@/server/observability/api-logging";
import { deletePortfolio, getPortfolio } from "@/server/portfolio/portfolios";
import { buildShareUrl } from "@/server/portfolio/sharing";

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

  // 공유 URL은 요청 호스트가 있어야 만들 수 있어 매핑 단계에서 비워 둔다.
  return success({
    ...portfolio,
    share: {
      ...portfolio.share,
      url: portfolio.share.published && portfolio.share.slug
        ? buildShareUrl(portfolio.share.slug, getBaseUrl(request))
        : null,
    },
  });
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
