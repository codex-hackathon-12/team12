import { requireUser } from "@/server/auth/require-user";
import { ActiveGenerationError, retryJob } from "@/server/generation/jobs";
import { failure, success } from "@/server/http";
import { getRequestId, logOperationFailure, withApiLogging } from "@/server/observability/api-logging";

export const runtime = "nodejs";

async function handlePOST(
  request: Request,
  context: { params: Promise<{ jobId: string }> },
): Promise<Response> {
  const authentication = await requireUser(request);
  if ("response" in authentication) {
    return authentication.response;
  }

  const { jobId } = await context.params;
  try {
    const result = await retryJob(authentication.user.id, jobId);
    if (result.kind === "not_found") {
      return failure("NOT_FOUND", "생성 작업을 찾을 수 없습니다.", 404);
    }
    if (result.kind === "not_retryable") {
      return failure("JOB_NOT_RETRYABLE", "실패한 생성 작업만 재시도할 수 있습니다.", 409, {
        retryable: false,
      });
    }

    return success({ previousJobId: result.previousJobId, job: result.job }, 202);
  } catch (error) {
    if (error instanceof ActiveGenerationError) {
      return failure("GENERATION_IN_PROGRESS", "진행 중인 생성 작업이 있습니다.", 409);
    }

    logOperationFailure({
      domain: "generations",
      operation: "job.retry",
      requestId: getRequestId(request),
      error,
    });
    return failure("INTERNAL_ERROR", "생성 작업 재시도를 처리하지 못했습니다.", 500);
  }
}

export const POST = withApiLogging(
  { domain: "generations", operation: "job.retry", route: "/api/v1/generations/[jobId]/retry" },
  handlePOST,
);
