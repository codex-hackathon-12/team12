import { failure, success } from "@/server/http";
import { withApiLogging } from "@/server/observability/api-logging";
import { getPublicPortfolio } from "@/server/portfolio/portfolios";

/**
 * 인증이 없는 공개 조회다. 소유자 확인 대신 공개 상태만 본다.
 * `getPublicPortfolio`가 published_at 조건을 갖고 있으며, 비공개나 없는 슬러그는
 * 존재 여부를 구분하지 않고 404로 답한다.
 */
async function handleGET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await context.params;
  const portfolio = await getPublicPortfolio(slug);

  if (!portfolio) {
    return failure("NOT_FOUND", "공개된 포트폴리오를 찾을 수 없습니다.", 404);
  }

  return success(portfolio);
}

export const GET = withApiLogging(
  { domain: "portfolios", operation: "portfolio.public.read", route: "/api/v1/public/portfolios/[slug]" },
  handleGET,
);
