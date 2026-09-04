import { GENERATION_INPUT_LIMITS, MAX_GENERATION_REPOSITORIES } from "@/contracts/api-contract";
import { requireUser } from "@/server/auth/require-user";
import { ActiveGenerationError, createJob } from "@/server/generation/jobs";
import { RepositoryLookupError } from "@/server/github/repositories";
import { failure, success } from "@/server/http";
import { getRequestId, logOperationFailure, withApiLogging } from "@/server/observability/api-logging";

export const runtime = "nodejs";

async function handlePOST(request: Request): Promise<Response> {
  const authentication = await requireUser(request);
  if ("response" in authentication) return authentication.response;
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return failure("VALIDATION_ERROR", "요청 본문이 올바르지 않습니다.", 400);
  }
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const highlights = Array.isArray(body.highlights) ? body.highlights : [];
  // 같은 저장소를 두 번 고르면 프로젝트가 중복되므로 순서를 지키며 중복만 제거한다.
  const repositoryIds = Array.isArray(body.repositoryIds)
    ? Array.from(new Set(body.repositoryIds.filter((value): value is string => typeof value === "string" && value.length > 0)))
    : [];
  if (
    repositoryIds.length === 0
    || prompt.length < 1
    || prompt.length > GENERATION_INPUT_LIMITS.prompt
    || highlights.length > GENERATION_INPUT_LIMITS.highlights
    || highlights.some((value) => typeof value !== "string" || value.length > GENERATION_INPUT_LIMITS.highlightLength)
  ) {
    return failure("VALIDATION_ERROR", "생성 요청 값이 올바르지 않습니다.", 400);
  }
  /* 예전에는 여기서 slice로 잘랐다. 잘린 줄 모르고 보낸 사람은 자기 직무가 왜
     중간에서 끊긴 채로 결과에 박혀 있는지 알 방법이 없다. 조용히 고치지 말고
     거절한다 — 화면도 같은 상한을 알고 있어 여기까지 오지 않는다. */
  const targetRole = typeof body.targetRole === "string" ? body.targetRole.trim() : "";
  if (targetRole.length > GENERATION_INPUT_LIMITS.targetRole) {
    return failure(
      "VALIDATION_ERROR",
      `지원 직무는 ${GENERATION_INPUT_LIMITS.targetRole}자 이내로 입력해주세요.`,
      400,
    );
  }
  if (repositoryIds.length > MAX_GENERATION_REPOSITORIES) {
    return failure("TOO_MANY_REPOSITORIES", `저장소는 한 번에 최대 ${MAX_GENERATION_REPOSITORIES}개까지 선택할 수 있습니다.`, 400);
  }
  if (body.tone !== undefined && body.tone !== "professional" && body.tone !== "concise" && body.tone !== "storytelling") {
    return failure("VALIDATION_ERROR", "tone 값이 올바르지 않습니다.", 400);
  }
  try {
    const job = await createJob(authentication.user.id, {
      repositoryIds,
      prompt,
      targetRole: targetRole || undefined,
      tone: body.tone as "professional" | "concise" | "storytelling" | undefined,
      highlights: highlights as string[],
    });
    return job ? success(job, 202) : failure("NOT_FOUND", "저장소를 찾을 수 없습니다.", 404);
  } catch (error) {
    if (error instanceof ActiveGenerationError) {
      return failure("GENERATION_IN_PROGRESS", "진행 중인 생성 작업이 있습니다.", 409);
    }
    logOperationFailure({
      domain: "generations",
      operation: "job.create",
      requestId: getRequestId(request),
      error,
    });
    if (error instanceof RepositoryLookupError) {
      return failure("INTERNAL_ERROR", "저장소 정보를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.", 500);
    }
    return failure("INTERNAL_ERROR", "생성 요청을 처리하지 못했습니다.", 500);
  }
}

export const POST = withApiLogging(
  { domain: "generations", operation: "job.create", route: "/api/v1/generations" },
  handlePOST,
);
