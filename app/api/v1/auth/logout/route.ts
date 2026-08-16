import { expiredSessionCookie, revokeSession } from "@/server/auth/session";
import { success } from "@/server/http";
import { withApiLogging } from "@/server/observability/api-logging";

async function handlePOST(request: Request): Promise<Response> {
  await revokeSession(request);
  const response = success({ loggedOut: true });
  response.headers.append("Set-Cookie", expiredSessionCookie());
  return response;
}

export const POST = withApiLogging(
  { domain: "auth", operation: "session.logout", route: "/api/v1/auth/logout" },
  handlePOST,
);
