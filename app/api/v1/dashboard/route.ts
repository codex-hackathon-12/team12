import { getDashboardData } from "@/server/dashboard/dashboard";
import { success } from "@/server/http";
import { withApiLogging } from "@/server/observability/api-logging";

async function handleGET(request: Request): Promise<Response> {
  return success(await getDashboardData(request));
}

export const GET = withApiLogging(
  { domain: "dashboard", operation: "dashboard.read", route: "/api/v1/dashboard" },
  handleGET,
);
