import { expiredSessionCookie, revokeSession } from "@/server/auth/session";
import { success } from "@/server/http";

export async function POST(request: Request): Promise<Response> {
  await revokeSession(request);
  const response = success({ loggedOut: true });
  response.headers.append("Set-Cookie", expiredSessionCookie());
  return response;
}
