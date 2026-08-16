import { getTasteSample } from "@/server/content/catalog";
import { success } from "@/server/http";
import { withApiLogging } from "@/server/observability/api-logging";

async function handleGET(): Promise<Response> {
  return success(getTasteSample());
}

export const GET = withApiLogging(
  { domain: "taste", operation: "taste.sample.read", route: "/api/v1/taste/sample" },
  handleGET,
);
