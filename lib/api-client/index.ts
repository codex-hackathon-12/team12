import type { ApiClient } from "@/lib/api-client/client";
import { HttpApiClient } from "@/lib/api-client/adapters/http";
import { MockApiClient } from "@/lib/api-client/adapters/mock";

export { ApiClientError } from "@/lib/api-client/adapters/http";

export const apiMode =
  process.env.NEXT_PUBLIC_API_MODE === "http" ? "http" : "mock";

export const apiClient: ApiClient =
  apiMode === "http" ? new HttpApiClient() : new MockApiClient();

export type { ApiClient } from "@/lib/api-client/client";
