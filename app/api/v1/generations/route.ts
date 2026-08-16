import { requireUser } from "@/server/auth/require-user";
import { ActiveGenerationError, createJob } from "@/server/generation/jobs";
import { failure, success } from "@/server/http";

export async function POST(request: Request): Promise<Response> {
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
  if (typeof body.repositoryId !== "string" || !body.repositoryId || prompt.length < 1 || prompt.length > 2000 || highlights.length > 10 || highlights.some((value) => typeof value !== "string" || value.length > 100)) {
    return failure("VALIDATION_ERROR", "생성 요청 값이 올바르지 않습니다.", 400);
  }
  if (body.tone !== undefined && body.tone !== "professional" && body.tone !== "concise" && body.tone !== "storytelling") {
    return failure("VALIDATION_ERROR", "tone 값이 올바르지 않습니다.", 400);
  }
  try {
    const job = await createJob(authentication.user.id, {
      repositoryId: body.repositoryId,
      prompt,
      targetRole: typeof body.targetRole === "string" ? body.targetRole.slice(0, 100) : undefined,
      tone: body.tone as "professional" | "concise" | "storytelling" | undefined,
      highlights: highlights as string[],
    });
    return job ? success(job, 202) : failure("NOT_FOUND", "저장소를 찾을 수 없습니다.", 404);
  } catch (error) {
    return error instanceof ActiveGenerationError
      ? failure("GENERATION_IN_PROGRESS", "진행 중인 생성 작업이 있습니다.", 409)
      : failure("INTERNAL_ERROR", "생성 요청을 처리하지 못했습니다.", 500);
  }
}
