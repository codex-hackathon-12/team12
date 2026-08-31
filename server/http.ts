type ApiErrorCode =
  | "AUTH_REQUIRED"
  | "AUTH_FAILED"
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "GITHUB_CONNECTION_ERROR"
  | "GITHUB_RATE_LIMITED"
  | "GENERATION_IN_PROGRESS"
  | "GENERATION_FAILED"
  | "JOB_NOT_RETRYABLE"
  | "ACCOUNT_DELETION_IN_PROGRESS"
  | "MOCK_PAYMENT_FAILED"
  | "TOO_MANY_REPOSITORIES"
  | "INTERNAL_ERROR";

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
export function getBaseUrl(request: Request): string {
  const headers = request.headers;
  const host = headers.get("x-forwarded-host") ?? headers.get("host") ?? "localhost:3000";
  const protocol = headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}
