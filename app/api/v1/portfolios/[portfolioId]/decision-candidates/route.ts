import { requireUser } from "@/server/auth/require-user";
import { failure, success } from "@/server/http";
import { withApiLogging } from "@/server/observability/api-logging";
import { listDecisionCandidates } from "@/server/portfolio/request-questions";

/**
 * 저장소에서 찾은 결정 후보.
 *
 * 초안이 결정을 고르는 일은 모델이 한다. 그런데 무엇이 말할 만한 결정인지는
 * 만든 사람이 안다. 저장소에 남아 있는 본인 PR과 커밋 제목을 그대로 돌려주고
 * 지원자가 고르게 한다.
 *
 * 모델을 부르지 않으므로 크레딧을 쓰지 않는다. 근거가 남아 있지 않으면 빈
 * 배열이고 오류가 아니다 — 후보가 없다고 결정을 못 쓸 이유는 없다.
 */

async function handleGET(
  request: Request,
  context: { params: Promise<{ portfolioId: string }> },
): Promise<Response> {
  const authentication = await requireUser(request);
  if ("response" in authentication) {
    return authentication.response;
  }

  const repositoryName = new URL(request.url).searchParams.get("repositoryName")?.trim() ?? "";
  if (!repositoryName) {
    return failure("VALIDATION_ERROR", "어느 프로젝트의 후보인지 알려주세요.", 400);
  }

  const { portfolioId } = await context.params;
  const result = await listDecisionCandidates(authentication.user.id, portfolioId, repositoryName);

  if ("kind" in result) {
    return failure("NOT_FOUND", "포트폴리오나 프로젝트를 찾을 수 없습니다.", 404);
  }

  return success(result);
}

export const GET = withApiLogging(
  {
    domain: "portfolios",
    operation: "portfolio.decisionCandidates",
    route: "/api/v1/portfolios/[portfolioId]/decision-candidates",
  },
  handleGET,
);
