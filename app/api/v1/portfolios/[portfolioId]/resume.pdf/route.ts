import { requireUser } from "@/server/auth/require-user";
import { failure } from "@/server/http";
import { withApiLogging } from "@/server/observability/api-logging";
import { downloadResume } from "@/server/portfolio/resume";

async function handleGET(
  request: Request,
  context: { params: Promise<{ portfolioId: string }> },
): Promise<Response> {
  const authentication = await requireUser(request);
  if ("response" in authentication) return authentication.response;
  const { portfolioId } = await context.params;
  const pdf = await downloadResume(authentication.user.id, portfolioId);
  if (!pdf) return failure("NOT_FOUND", "PDF 이력서를 찾을 수 없습니다.", 404);
  return new Response(pdf, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="portfolio-${portfolioId}.pdf"`,
      "cache-control": "private, no-store",
    },
  });
}

export const GET = withApiLogging(
  { domain: "portfolios", operation: "resume.download", route: "/api/v1/portfolios/[portfolioId]/resume.pdf" },
  handleGET,
);
