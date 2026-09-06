/* 계약에서 그대로 가져온다. 여기 목록을 따로 두고 있었는데, 계약에 코드를
   더해도 라우트가 그 코드를 쓸 수 없었다 — 두 목록이 어긋나는 것을 타입이
   막아주지 않고 새 코드를 쓰는 쪽에서 뒤늦게 터졌다. */
import type { ApiErrorCode } from "@/contracts/api-contract";

export function json(data: unknown, status = 200, headers?: HeadersInit): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { status, headers: responseHeaders });
}

export function success(data: unknown, status = 200, meta?: unknown): Response {
  return json(meta === undefined ? { data } : { data, meta }, status);
}

export function failure(
  code: ApiErrorCode,
  message: string,
  status: number,
  details?: Record<string, unknown>,
): Response {
  return json(
    { error: { code, message, ...(details ? { details } : {}) } },
    status,
    { "x-api-error-code": code },
  );
}

export function parseCookie(request: Request, name: string): string | null {
  const cookie = request.headers.get("cookie");
  if (!cookie) {
    return null;
  }

  for (const part of cookie.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) {
      return value.join("=") || null;
    }
  }

  return null;
}

export function serializeCookie(
  name: string,
  value: string,
  options: {
    maxAge?: number;
    path?: string;
  } = {},
): string {
  const parts = [
    `${name}=${value}`,
    `Path=${options.path ?? "/"}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
  ];

  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${options.maxAge}`);
  }

  return parts.join("; ");
}

/**
 * 로그인 후 돌아갈 경로인지 확인한다.
 *
 * `//host`만 막으면 부족하다. 브라우저는 백슬래시를 슬래시로 정규화하므로
 * `/\evil.com`이 `//evil.com`이 되어 외부로 나간다. 제어문자도 같은 이유로 막는다.
 */
export function isSafeReturnPath(value: string | null): value is string {
  if (!value || !value.startsWith("/")) {
    return false;
  }
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/u.test(value)) {
    return false;
  }
  return !/^\/[/\\]/u.test(value);
}

/**
 * 요청 헤더에서 서비스의 기준 주소를 만든다.
 * 배포 환경마다 도메인이 달라 환경변수로 고정하면 프리뷰에서 어긋나므로,
 * `app/layout.tsx`가 metadata를 만들 때와 같은 방식을 쓴다.
 */
/**
 * 공유 링크에 쓸 정식 주소를 만든다.
 *
 * 요청 호스트를 그대로 쓰면 안 된다. 소유자가 프리뷰 배포에서 "공개 링크
 * 만들기"를 누르면 그 프리뷰 호스트가 링크에 박히는데, 프리뷰에는 배포 보호가
 * 걸려 있어 만든 사람만 열리고 링크를 받은 사람은 로그인 벽을 만난다.
 * localhost에서 만든 링크도 마찬가지로 남에게는 열리지 않는다.
 *
 * 그래서 설정된 정식 주소를 먼저 쓰고, 없으면 Vercel이 배포마다 넣어주는
 * 프로덕션 도메인을 쓴다. 둘 다 없을 때만 요청 호스트로 돌아간다(로컬 개발).
 */
export function resolvePublicBaseUrl(fallbackUrl: string): string {
  const configured = process.env.PUBLIC_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/u, "");
  }

  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (productionHost) {
    return `https://${productionHost.replace(/\/+$/u, "")}`;
  }

  return fallbackUrl.replace(/\/+$/u, "");
}

/** 요청이 도착한 호스트. 정식 주소를 알 수 없을 때의 마지막 수단이다. */
export function getRequestOrigin(headers: Headers): string {
  const host = headers.get("x-forwarded-host") ?? headers.get("host") ?? "localhost:3000";
  const protocol = headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}

export function getBaseUrl(request: Request): string {
  return resolvePublicBaseUrl(getRequestOrigin(request.headers));
}
