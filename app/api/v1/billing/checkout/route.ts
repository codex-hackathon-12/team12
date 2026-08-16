import { requireUser } from "@/server/auth/require-user";
import { createMockCheckout } from "@/server/billing/mock-catalog";
import { failure, success } from "@/server/http";
import { withApiLogging } from "@/server/observability/api-logging";

function mockPaymentFailure(): Response {
  return failure("MOCK_PAYMENT_FAILED", "선택한 mock 결제 상품을 처리할 수 없습니다.", 400);
}

async function handlePOST(request: Request): Promise<Response> {
  const authentication = await requireUser(request);
  if ("response" in authentication) {
    return authentication.response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return mockPaymentFailure();
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return mockPaymentFailure();
  }

  const productId = (body as Record<string, unknown>).productId;
  if (typeof productId !== "string" || !productId) {
    return mockPaymentFailure();
  }

  const checkout = createMockCheckout(productId);
  return checkout ? success(checkout) : mockPaymentFailure();
}

export const POST = withApiLogging(
  { domain: "billing", operation: "billing.checkout.create", route: "/api/v1/billing/checkout" },
  handlePOST,
);
