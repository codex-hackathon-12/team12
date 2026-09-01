import assert from "node:assert/strict";
import test from "node:test";

const { loadAllRepositories } = await import(
  new URL("../lib/api-client/load-all-repositories.ts", import.meta.url)
);

const repo = (id) => ({ id, name: id });

/** 요청받은 커서를 기록하면서 페이지를 순서대로 돌려주는 가짜 서버. */
const pager = (pages) => {
  const calls = [];
  const fetchPage = async (query) => {
    calls.push(query);
    const index = query.cursor ? Number(query.cursor) : 0;
    const page = pages[index];
    return {
      repositories: page,
      nextCursor: index + 1 < pages.length ? String(index + 1) : null,
      hasNextPage: index + 1 < pages.length,
    };
  };
  return { fetchPage, calls };
};

test("커서를 따라 끝까지 받아 순서대로 이어 붙인다", async () => {
  const { fetchPage, calls } = pager([[repo("a"), repo("b")], [repo("c")]]);
  const result = await loadAllRepositories(fetchPage);

  assert.deepEqual(result.map((item) => item.id), ["a", "b", "c"]);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].cursor, undefined);
  assert.equal(calls[1].cursor, "1");
});

test("한 페이지로 끝나면 한 번만 요청한다", async () => {
  const { fetchPage, calls } = pager([[repo("a")]]);
  assert.deepEqual((await loadAllRepositories(fetchPage)).map((item) => item.id), ["a"]);
  assert.equal(calls.length, 1);
});

test("라우트 상한인 50을 요청한다", async () => {
  // limit을 넘기지 않으면 서버 기본값 20에서 조용히 잘린다.
  const { fetchPage, calls } = pager([[repo("a")]]);
  await loadAllRepositories(fetchPage);
  assert.equal(calls[0].limit, 50);
});

test("페이지 경계에서 겹친 저장소는 한 번만 담는다", async () => {
  const { fetchPage } = pager([[repo("a"), repo("b")], [repo("b"), repo("c")]]);
  assert.deepEqual((await loadAllRepositories(fetchPage)).map((item) => item.id), ["a", "b", "c"]);
});

test("커서가 끝나지 않아도 무한히 돌지 않는다", async () => {
  let calls = 0;
  const fetchPage = async () => {
    calls += 1;
    return { repositories: [repo(`r${calls}`)], nextCursor: "next", hasNextPage: true };
  };
  const result = await loadAllRepositories(fetchPage);
  assert.equal(calls, 20);
  assert.equal(result.length, 20);
});

test("빈 목록도 그대로 돌려준다", async () => {
  const fetchPage = async () => ({ repositories: [], nextCursor: null, hasNextPage: false });
  assert.deepEqual(await loadAllRepositories(fetchPage), []);
});
