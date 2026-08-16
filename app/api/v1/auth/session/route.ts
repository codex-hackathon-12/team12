import { getSessionUser, toAuthSessionDto } from "@/server/auth/session";
import { success } from "@/server/http";
import { withApiLogging } from "@/server/observability/api-logging";

async function handleGET(request: Request): Promise<Response> {
  const user = await getSessionUser(request);
  return success(toAuthSessionDto(user));
}

export const GET = withApiLogging(
  { domain: "auth", operation: "session.read", route: "/api/v1/auth/session" },
  handleGET,
);
