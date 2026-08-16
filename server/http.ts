type ApiErrorCode =
  | "AUTH_REQUIRED"
  | "AUTH_FAILED"
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "GITHUB_CONNECTION_ERROR"
  | "GITHUB_RATE_LIMITED"
  | "GENERATION_FAILED"
  | "JOB_NOT_RETRYABLE"
  | "MOCK_PAYMENT_FAILED"
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
  return json({ error: { code, message, ...(details ? { details } : {}) } }, status);
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

export function isSafeReturnPath(value: string | null): value is string {
  return Boolean(value && value.startsWith("/") && !value.startsWith("//"));
}
