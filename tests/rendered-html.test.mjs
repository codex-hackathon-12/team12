import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { access, readFile } from "node:fs/promises";
import { createServer } from "node:net";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const templateRoot = new URL("../", import.meta.url);

async function getAvailablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Unable to reserve a local test port.");
  }
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

async function stopServer(server) {
  if (server.exitCode !== null) {
    return;
  }
  server.kill("SIGTERM");
  await Promise.race([once(server, "exit"), delay(5000)]);
  if (server.exitCode === null) {
    server.kill("SIGKILL");
    await once(server, "exit");
  }
}

async function render(pathname = "/dashboard") {
  const port = await getAvailablePort();
  const nextCli = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));
  const server = spawn(process.execPath, [nextCli, "start", "-p", String(port)], {
    cwd: fileURLToPath(templateRoot),
    env: { ...process.env, NEXT_PUBLIC_API_MODE: "mock" },
    stdio: "pipe",
  });
  let output = "";
  server.stdout.on("data", (chunk) => { output += chunk.toString(); });
  server.stderr.on("data", (chunk) => { output += chunk.toString(); });

  try {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (server.exitCode !== null) {
        throw new Error(`Next.js test server exited early: ${output}`);
      }
      try {
        return await fetch(`http://127.0.0.1:${port}${pathname}`, {
          headers: { accept: "text/html", host: "localhost" },
        });
      } catch {
        await delay(100);
      }
    }
    throw new Error(`Next.js test server did not start: ${output}`);
  } finally {
    await stopServer(server);
  }
}

test("server-renders the folio.ai dashboard shell", async (context) => {
  let response;
  try {
    response = await render();
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "EPERM") {
      context.skip("The current sandbox does not allow local TCP listeners.");
      return;
    }
    throw error;
  }
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /folio\.ai/);
  assert.match(html, /오늘의 작업 공간을 준비하고 있어요/);
  assert.match(html, /GitHub 포트폴리오 AI/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("keeps the public landing anonymous-only and mock mode as the default", async () => {
  const [page, layout, packageJson, apiClient] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../lib/api-client/index.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /className="landing-page"/);
  assert.match(page, /GITHUB TO CAREER STORY/);
  assert.match(page, /TASTE THE RESULT/);
  assert.match(page, /router\.replace\("\/dashboard"\)/);
  assert.match(page, /preview"\) === "landing"/);
  assert.match(page, /"localhost", "127\.0\.0\.1"/);
  assert.match(page, /GitHub 로그인/);
  assert.doesNotMatch(page, /대시보드로 이동/);
  assert.match(layout, /\/og\.png/);
  assert.doesNotMatch(layout, /codex-preview|_sites-preview/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.match(packageJson, /"next"/);
  assert.match(packageJson, /"workflow"/);
  assert.doesNotMatch(packageJson, /"vinext"|"wrangler"|"@cloudflare\/vite-plugin"/);
  assert.match(apiClient, /=== "http" \? "http" : "mock"/);

  await assert.rejects(
    access(new URL("../app/_sites-preview", import.meta.url)),
  );
  await access(new URL("../public/og.png", import.meta.url));
  await access(new URL("../contracts/api-contract.ts", import.meta.url));
  await access(new URL("../mocks/api/fixtures/index.ts", import.meta.url));
  await access(new URL("../lib/api-client/adapters/http/index.ts", import.meta.url));
  await access(new URL("../lib/api-client/adapters/mock/index.ts", import.meta.url));
  await access(new URL("../.next/server/app/.well-known/workflow/v1/flow/route.js", import.meta.url));
  await access(templateRoot);
});
