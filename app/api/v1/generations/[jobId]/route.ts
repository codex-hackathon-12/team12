import { requireUser } from "@/server/auth/require-user";
import { getJob } from "@/server/generation/jobs";
import { expireStaleJobs, isStaleJob } from "@/server/generation/stale-jobs";
import { failure, success } from "@/server/http";
import { withApiLogging } from "@/server/observability/api-logging";

async function handleGET(request: Request, context: { params: Promise<{ jobId: string }> }): Promise<Response> {
  const authentication = await requireUser(request);
  if ("response" in authentication) return authentication.response;
  const { jobId } = await context.params;
  const job = await getJob(authentication.user.id, jobId);
  if (!job) return failure("NOT_FOUND", "생성 작업을 찾을 수 없습니다.", 404);

  /* 진행 화면이 2초마다 여기를 두드린다. 멈춘 작업을 보고 있는 사용자는
     이 경로를 반드시 지나므로, 한 번의 폴링 안에 무한 대기가 재시도 가능한
     실패로 바뀐다. 조건을 만족할 때만 쓰기 때문에 평소 폴링은 읽기만 한다. */
  if (isStaleJob(job.status, job.updatedAt)) {
    await expireStaleJobs(authentication.user.id);
    const refreshed = await getJob(authentication.user.id, jobId);
    return refreshed ? success(refreshed) : success(job);
  }

  return success(job);
}

export const GET = withApiLogging(
  { domain: "generations", operation: "job.read", route: "/api/v1/generations/[jobId]" },
  handleGET,
);
