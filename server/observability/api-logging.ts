export type ApiDomain =
  | "auth"
  | "repositories"
  | "generations"
  | "portfolios"
  | "dashboard"
  | "credits"
  | "billing"
  | "gallery"
  | "announcements"
  | "taste";

type ApiRouteContext = {
  domain: ApiDomain;
  operation: string;
  route: string;
};

type RouteHandler<Arguments extends [Request, ...unknown[]]> = (...args: Arguments) => Promise<Response>;

type OperationFailureContext = {
  domain: ApiDomain;
  operation: string;
  error: unknown;
  requestId?: string;
  userId?: string;
  jobId?: string;
  portfolioId?: string;
};

export const REQUEST_ID_HEADER = "x-request-id";

const requestIds = new WeakMap<Request, string>();
/* 로그에 사용자가 없으면 "이 사람에게 무슨 일이 있었나"를 되짚을 수 없다.
   requestId와 같은 방식으로 요청에 매달아 둔다. */
const userIds = new WeakMap<Request, string>();

function elapsedMilliseconds(startedAt: number): number {
  return Math.round(performance.now() - startedAt);
}

function safeErrorMetadata(error: unknown): { errorType: string; errorMessage?: string } {
  if (!(error instanceof Error)) {
    return { errorType: typeof error };
  }

  const errorMessage = error.message
    .replace(/\bBearer\s+\S+/giu, "Bearer [REDACTED]")
    .replace(/\b(token|api[_-]?key|secret|password|cookie)\b\s*[:=]\s*\S+/giu, "$1=[REDACTED]")
    .slice(0, 300);

  return errorMessage ? { errorType: error.name, errorMessage } : { errorType: error.name };
}

function writeLog(level: "warn" | "error", values: Record<string, unknown>): void {
  console[level](JSON.stringify({ timestamp: new Date().toISOString(), ...values }));
}

function internalErrorResponse(): Response {
  return new Response(
    JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "요청을 처리하지 못했어요." } }),
    {
      status: 500,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "x-api-error-code": "INTERNAL_ERROR",
      },
    },
  );
}

export function getRequestId(request: Request): string | undefined {
  return requestIds.get(request);
}

/** 인증을 통과한 시점에 한 번 부르면 이후 로그가 사용자를 함께 남긴다. */
export function setLogUser(request: Request, userId: string): void {
  userIds.set(request, userId);
}

export function getLogUser(request: Request): string | undefined {
  return userIds.get(request);
}

export function logOperationFailure(context: OperationFailureContext): void {
  writeLog("error", {
    event: "backend.operation.failed",
    domain: context.domain,
    operation: context.operation,
    requestId: context.requestId,
    userId: context.userId,
    jobId: context.jobId,
    portfolioId: context.portfolioId,
    ...safeErrorMetadata(context.error),
  });
}

export function withApiLogging<Arguments extends [Request, ...unknown[]]>(
  context: ApiRouteContext,
  handler: RouteHandler<Arguments>,
): RouteHandler<Arguments> {
  return async (...args: Arguments): Promise<Response> => {
    const [request] = args;
    const requestId = crypto.randomUUID();
    const startedAt = performance.now();
    requestIds.set(request, requestId);

    try {
      const response = await handler(...args);
      response.headers.set(REQUEST_ID_HEADER, requestId);

      if (response.status >= 400) {
        writeLog(response.status >= 500 ? "error" : "warn", {
          event: "api.request.failed",
          domain: context.domain,
          operation: context.operation,
          route: context.route,
          method: request.method,
          status: response.status,
          errorCode: response.headers.get("x-api-error-code"),
          requestId,
          userId: userIds.get(request),
          durationMs: elapsedMilliseconds(startedAt),
        });
      }

      return response;
    } catch (error) {
      const response = internalErrorResponse();
      response.headers.set(REQUEST_ID_HEADER, requestId);
      writeLog("error", {
        event: "api.request.exception",
        domain: context.domain,
        operation: context.operation,
        route: context.route,
        method: request.method,
        status: response.status,
        errorCode: "INTERNAL_ERROR",
        requestId,
        userId: userIds.get(request),
        durationMs: elapsedMilliseconds(startedAt),
        ...safeErrorMetadata(error),
      });
      return response;
    } finally {
      requestIds.delete(request);
      userIds.delete(request);
    }
  };
}
