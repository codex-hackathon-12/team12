import assert from "node:assert/strict";
import test from "node:test";

const {
  REQUEST_ID_HEADER,
  getRequestId,
  logOperationFailure,
  withApiLogging,
} = await import(new URL("../server/observability/api-logging.ts", import.meta.url));

async function captureConsole(method, callback) {
  const original = console[method];
  const entries = [];
  console[method] = (entry) => entries.push(entry);

  try {
    await callback(entries);
  } finally {
    console[method] = original;
  }
}

test("adds a request ID and structured domain log for failed API responses", { concurrency: false }, async () => {
  await captureConsole("warn", async (entries) => {
    const handler = withApiLogging(
      { domain: "repositories", operation: "repository.list", route: "/api/v1/repositories" },
      async (request) => {
        assert.match(getRequestId(request) ?? "", /^[0-9a-f-]{36}$/i);
        return new Response(JSON.stringify({ error: { code: "VALIDATION_ERROR" } }), {
          status: 400,
          headers: { "x-api-error-code": "VALIDATION_ERROR" },
        });
      },
    );
    const response = await handler(new Request("https://example.test/api/v1/repositories"));
    const entry = JSON.parse(entries[0]);

    assert.match(response.headers.get(REQUEST_ID_HEADER) ?? "", /^[0-9a-f-]{36}$/i);
    assert.equal(entry.event, "api.request.failed");
    assert.equal(entry.domain, "repositories");
    assert.equal(entry.operation, "repository.list");
    assert.equal(entry.status, 400);
    assert.equal(entry.errorCode, "VALIDATION_ERROR");
  });
});

test("returns a safe internal error response and redacts secrets from exception logs", { concurrency: false }, async () => {
  await captureConsole("error", async (entries) => {
    const handler = withApiLogging(
      { domain: "auth", operation: "session.read", route: "/api/v1/auth/session" },
      async () => {
        throw new Error("Bearer raw-secret-token token=another-secret");
      },
    );
    const response = await handler(new Request("https://example.test/api/v1/auth/session"));
    const entry = JSON.parse(entries[0]);

    assert.equal(response.status, 500);
    assert.equal(response.headers.get("x-api-error-code"), "INTERNAL_ERROR");
    assert.deepEqual(await response.json(), {
      error: { code: "INTERNAL_ERROR", message: "요청을 처리하지 못했어요." },
    });
    assert.equal(entry.event, "api.request.exception");
    assert.equal(entry.domain, "auth");
    assert.doesNotMatch(JSON.stringify(entry), /raw-secret-token|another-secret/);
  });
});

test("records asynchronous operation failures with their generation job ID", { concurrency: false }, async () => {
  await captureConsole("error", async (entries) => {
    logOperationFailure({
      domain: "generations",
      operation: "workflow.run",
      jobId: "job_123",
      error: new Error("OpenAI response failed with status 429."),
    });
    const entry = JSON.parse(entries[0]);

    assert.equal(entry.event, "backend.operation.failed");
    assert.equal(entry.domain, "generations");
    assert.equal(entry.operation, "workflow.run");
    assert.equal(entry.jobId, "job_123");
    assert.equal(entry.errorMessage, "OpenAI response failed with status 429.");
  });
});
