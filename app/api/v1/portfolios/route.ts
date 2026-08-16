import { requireUser } from "@/server/auth/require-user";
import { success } from "@/server/http";
import { decodePortfolioCursor, encodePortfolioCursor } from "@/server/portfolio/mapper";
import { listPortfolios } from "@/server/portfolio/portfolios";
import { withApiLogging } from "@/server/observability/api-logging";

async function handleGET(request: Request): Promise<Response> {
  const authentication = await requireUser(request);
  if ("response" in authentication) {
    return authentication.response;
  }

  const url = new URL(request.url);
  const requestedLimit = Number(url.searchParams.get("limit") ?? "20");
  const limit = Number.isInteger(requestedLimit) && requestedLimit >= 1 && requestedLimit <= 50
    ? requestedLimit
    : 20;
  const result = await listPortfolios(authentication.user.id, {
    limit,
    offset: decodePortfolioCursor(url.searchParams.get("cursor")),
  });

  return success(
    { portfolios: result.portfolios },
    200,
    {
      nextCursor: encodePortfolioCursor(result.nextOffset),
      hasNextPage: result.hasNextPage,
    },
  );
}

export const GET = withApiLogging(
  { domain: "portfolios", operation: "portfolio.list", route: "/api/v1/portfolios" },
  handleGET,
);
