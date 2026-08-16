import type { ApiClient } from "@/lib/api-client/client";
import { HttpApiClient } from "@/lib/api-client/adapters/http";
import { MockApiClient } from "@/lib/api-client/adapters/mock";

const configuredApiMode =
  process.env.NEXT_PUBLIC_API_MODE === "http" ? "http" : "mock";

// 화면 녹화용 브랜치는 외부 인증과 DB 상태에 영향받지 않도록 Mock을 고정한다.
export const demoRecordingMode: boolean = true;
export const apiMode: "http" | "mock" = demoRecordingMode
  ? "mock"
  : configuredApiMode;

export const apiClient: ApiClient =
  apiMode === "http" ? new HttpApiClient() : new MockApiClient();

export type { ApiClient } from "@/lib/api-client/client";
