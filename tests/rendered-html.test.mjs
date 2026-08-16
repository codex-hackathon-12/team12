import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

async function render(pathname = "/dashboard") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html", host: "localhost" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the folio.ai dashboard shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /folio\.ai/);
  assert.match(html, /오늘의 작업 공간을 준비하고 있어요/);
  assert.match(html, /GitHub 포트폴리오 AI/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("removes the disposable starter and keeps mock mode as the default", async () => {
  const [page, layout, packageJson, apiClient] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../lib/api-client/index.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /redirect\("\/dashboard"\)/);
  assert.match(layout, /\/og\.png/);
  assert.doesNotMatch(layout, /codex-preview|_sites-preview/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.match(apiClient, /=== "http" \? "http" : "mock"/);

  await assert.rejects(
    access(new URL("../app/_sites-preview", import.meta.url)),
  );
  await access(new URL("../public/og.png", import.meta.url));
  await access(new URL("../contracts/api-contract.ts", import.meta.url));
  await access(new URL("../mocks/api/fixtures/index.ts", import.meta.url));
  await access(new URL("../lib/api-client/adapters/http/index.ts", import.meta.url));
  await access(new URL("../lib/api-client/adapters/mock/index.ts", import.meta.url));
  await access(templateRoot);
});
