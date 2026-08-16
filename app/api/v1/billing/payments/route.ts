import { requireUser } from "@/server/auth/require-user";
import { listMockPayments } from "@/server/billing/mock-catalog";
import { success } from "@/server/http";
import { withApiLogging } from "@/server/observability/api-logging";

async function handleGET(request: Request): Promise<Response> {
  const authentication = await requireUser(request);
  if ("response" in authentication) {
    return authentication.response;
  }

  return success({ payments: listMockPayments() });
}

export const GET = withApiLogging(
  { domain: "billing", operation: "billing.payment.list", route: "/api/v1/billing/payments" },
  handleGET,
);
