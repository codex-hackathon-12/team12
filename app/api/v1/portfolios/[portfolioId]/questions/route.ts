import type { PortfolioQuestionSlot } from "@/contracts/api-contract";
import { requireUser } from "@/server/auth/require-user";
import { failure, success } from "@/server/http";
import { withApiLogging } from "@/server/observability/api-logging";
import { requestPortfolioQuestions } from "@/server/portfolio/request-questions";

/**
 * 초안이 비워둔 자리를 지원자가 직접 연다.
 *
 * 답변을 받는 `statements`와 라우트를 나눈다. 본문 모양으로 분기하면 두 가지
 * 일이 한 주소에 얹혀, 어느 쪽이 실패했는지 로그에서도 갈리지 않는다.
 *
 * 모델을 부르지 않으므로 크레딧을 쓰지 않고, 생성 근거도 읽지 않으므로
 * 근거가 남아 있지 않은 오래된 포트폴리오에서도 열린다.
 */

const SLOTS: PortfolioQuestionSlot[] = ["keyDecision", "highlights"];

function parseSlot(value: unknown): PortfolioQuestionSlot | null {
  return SLOTS.find((slot) => slot === value) ?? null;
}

async function handlePOST(
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

  const repositoryName = typeof body.repositoryName === "string" ? body.repositoryName.trim() : "";
  const slot = parseSlot(body.slot);
  if (!repositoryName || !slot) {
    return failure("VALIDATION_ERROR", "어느 프로젝트의 어떤 자리를 열지 알려주세요.", 400);
  }

  /* 고른 결정의 한 줄. 저장소에서 본 그대로 오므로 다듬지 않고, 화면에
     그려지는 값이라 길이만 잰다. */
  const topic = typeof body.topic === "string" ? body.topic.trim().slice(0, 120) : undefined;

  const { portfolioId } = await context.params;
  const result = await requestPortfolioQuestions(authentication.user.id, portfolioId, {
    repositoryName,
    slot,
    topic: topic || undefined,
    replace: body.replace === true,
  });

  if ("kind" in result) {
    if (result.kind === "notFound") {
      return failure("NOT_FOUND", "포트폴리오나 프로젝트를 찾을 수 없습니다.", 404);
    }
    /* 채워진 자리를 물으면 답해도 병합이 버려 아무것도 안 바뀐다. 열어주는
       것보다 여기서 막는 편이 낫다. */
    return failure("SLOT_ALREADY_FILLED", "이 자리는 이미 채워져 있어요.", 409);
  }

  return success(result);
}

export const POST = withApiLogging(
  {
    domain: "portfolios",
    operation: "portfolio.questions",
    route: "/api/v1/portfolios/[portfolioId]/questions",
  },
  handlePOST,
);
