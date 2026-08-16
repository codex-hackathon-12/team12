import { requireUser } from "@/server/auth/require-user";
import { getJob } from "@/server/generation/jobs";
import { failure, success } from "@/server/http";
import { withApiLogging } from "@/server/observability/api-logging";

async function handleGET(request: Request, context: { params: Promise<{ jobId: string }> }): Promise<Response> {
  const authentication = await requireUser(request);
  if ("response" in authentication) return authentication.response;
  const { jobId } = await context.params;
  const job = await getJob(authentication.user.id, jobId);
  return job ? success(job) : failure("NOT_FOUND", "생성 작업을 찾을 수 없습니다.", 404);
}

export const GET = withApiLogging(
  { domain: "generations", operation: "job.read", route: "/api/v1/generations/[jobId]" },
  handleGET,
);
