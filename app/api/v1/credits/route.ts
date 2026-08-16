import { requireUser } from "@/server/auth/require-user";
import { getMockCreditSummary } from "@/server/billing/mock-catalog";
import { success } from "@/server/http";
import { withApiLogging } from "@/server/observability/api-logging";

async function handleGET(request: Request): Promise<Response> {
  const authentication = await requireUser(request);
  if ("response" in authentication) {
    return authentication.response;
  }

  return success(getMockCreditSummary());
}

export const GET = withApiLogging(
  { domain: "credits", operation: "credit.read", route: "/api/v1/credits" },
  handleGET,
);
