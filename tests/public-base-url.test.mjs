import assert from "node:assert/strict";
import test from "node:test";

const { getRequestOrigin, resolvePublicBaseUrl } = await import(
  new URL("../server/http.ts", import.meta.url)
);

const withEnv = async (values, run) => {
  const previous = { ...process.env };
  Object.assign(process.env, values);
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
  }
  try {
    await run();
  } finally {
    process.env = previous;
  }
};

test("설정한 정식 주소가 가장 우선한다", async () => {
  await withEnv(
    { PUBLIC_BASE_URL: "https://folio.klr.kr", VERCEL_PROJECT_PRODUCTION_URL: "team12.vercel.app" },
    () => {
      assert.equal(
        resolvePublicBaseUrl("https://team12-git-develop-x.vercel.app"),
        "https://folio.klr.kr",
      );
    },
  );
});

test("설정이 없으면 Vercel 프로덕션 도메인을 쓴다", async () => {
  await withEnv(
    { PUBLIC_BASE_URL: undefined, VERCEL_PROJECT_PRODUCTION_URL: "folio.klr.kr" },
    () => {
      // 프리뷰 호스트가 링크에 박히면 받는 사람이 배포 보호에 막힌다.
      assert.equal(
        resolvePublicBaseUrl("https://team12-git-develop-x.vercel.app"),
        "https://folio.klr.kr",
      );
    },
  );
});

test("둘 다 없으면 요청 호스트로 돌아간다", async () => {
  await withEnv(
    { PUBLIC_BASE_URL: undefined, VERCEL_PROJECT_PRODUCTION_URL: undefined },
    () => {
      assert.equal(resolvePublicBaseUrl("http://localhost:3000"), "http://localhost:3000");
    },
  );
});

test("끝의 슬래시는 링크를 만들 때 겹치지 않게 지운다", async () => {
  await withEnv({ PUBLIC_BASE_URL: "https://folio.klr.kr/" }, () => {
    assert.equal(resolvePublicBaseUrl("http://localhost:3000"), "https://folio.klr.kr");
  });
});

test("프록시 뒤에서도 요청 주소를 바르게 읽는다", () => {
  const headers = new Headers({ "x-forwarded-host": "folio.klr.kr", "x-forwarded-proto": "https" });
  assert.equal(getRequestOrigin(headers), "https://folio.klr.kr");
  assert.equal(getRequestOrigin(new Headers({ host: "localhost:3000" })), "http://localhost:3000");
});
