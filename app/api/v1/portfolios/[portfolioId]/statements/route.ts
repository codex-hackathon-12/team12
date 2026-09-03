import { PORTFOLIO_ANSWER_MAX_LENGTH } from "@/contracts/api-contract";
import { requireUser } from "@/server/auth/require-user";
import { failure, success } from "@/server/http";
import { withApiLogging } from "@/server/observability/api-logging";
import { applyPortfolioStatements } from "@/server/portfolio/apply-statements";

/**
 * 되묻기 답변을 받아 답한 자리만 다시 쓴다.
 *
 * 동기 처리다. 생성과 달리 GitHub을 다시 읽지 않고 모델 호출도 좁아서, 폴링
 * 화면을 만들 만큼 오래 걸리지 않는다. 무엇보다 새 생성 작업이 아니므로
 * 사용자당 활성 작업 1개 제한과 애초에 충돌하지 않는다.
 */

type AnswerInput = { questionId: string; answer: string };

function parseAnswers(value: unknown): AnswerInput[] | { message: string } {
  if (!Array.isArray(value) || value.length === 0) {
    return { message: "답변이 필요합니다." };
  }

  const answers: AnswerInput[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") {
      return { message: "답변 형식이 올바르지 않습니다." };
    }
    const entry = item as Record<string, unknown>;
    if (typeof entry.questionId !== "string" || typeof entry.answer !== "string") {
      return { message: "답변 형식이 올바르지 않습니다." };
    }

    const answer = entry.answer.trim();
    /* 빈 답은 "이 질문은 건너뛴다"는 뜻이다. 오류로 막으면 세 개 중 하나만
       답하고 싶은 사람이 아무것도 보낼 수 없다. */
    if (answer.length === 0) continue;

    // 조용히 자르지 않는다. 잘린 줄 모르고 보낸 사람은 자기 답이 왜 반쯤만
    // 반영됐는지 알 방법이 없다.
    if ([...answer].length > PORTFOLIO_ANSWER_MAX_LENGTH) {
      return { message: `답변은 ${PORTFOLIO_ANSWER_MAX_LENGTH}자 이내로 작성해주세요.` };
    }

    answers.push({ questionId: entry.questionId, answer });
  }

  if (answers.length === 0) {
    return { message: "답변이 필요합니다." };
  }
  return answers;
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

  const parsed = parseAnswers(body.answers);
  if (!Array.isArray(parsed)) {
    return failure("VALIDATION_ERROR", parsed.message, 400);
  }

  const { portfolioId } = await context.params;
  const result = await applyPortfolioStatements(authentication.user.id, portfolioId, parsed);

  if ("kind" in result) {
    if (result.kind === "notFound") {
      return failure("NOT_FOUND", "포트폴리오나 질문을 찾을 수 없습니다.", 404);
    }
    if (result.kind === "evidenceUnavailable") {
      return failure(
        "EVIDENCE_UNAVAILABLE",
        "이 포트폴리오의 생성 근거가 남아 있지 않아 다시 쓸 수 없어요.",
        409,
      );
    }
    return failure("VALIDATION_ERROR", "반영할 답변이 없습니다.", 400);
  }

  return success(result);
}

export const POST = withApiLogging(
  {
    domain: "portfolios",
    operation: "portfolio.statements",
    route: "/api/v1/portfolios/[portfolioId]/statements",
  },
  handlePOST,
);
