import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * 저장소 동기화가 예산 안에서 끝나는지 지킨다.
 *
 * GitHub을 최대 10번 순차로 부르는데 호출당 상한(15초)만 있고 전체 상한이
 * 없었다. 최악이면 150초를 한 함수 안에서 쓰겠다는 뜻인데 서버리스 함수는
 * 그 전에 플랫폼이 끊는다. 그러면 504가 나가고 사용자에게는 "가져오지
 * 못했어요"만 남는다 — 저장소가 많은 사람일수록 더 자주 그렇게 된다.
 *
 * 실제 시간을 재는 테스트는 느리고 불안정하다. 예산이 서로 앞뒤가 맞는지만
 * 본다: 전체 예산 < 라우트 실행 상한, 그리고 호출당 상한이 남은 예산을 넘지
 * 않게 잘라 쓰는지.
 */

const root = new URL("..", import.meta.url).pathname;
const source = readFileSync(root + "server/github/repositories.ts", "utf8");
const route = readFileSync(root + "app/api/v1/repositories/sync/route.ts", "utf8");

const number = (text, name) => {
  const match = text.match(new RegExp(`${name}\\s*=\\s*([0-9_]+)`, "u"));
  assert.ok(match, `${name}을 찾지 못했어요`);
  return Number(match[1].replace(/_/gu, ""));
};

test("전체 예산이 라우트 실행 상한보다 짧다", () => {
  /* 서버 쪽이 먼저 끝나야 부분 결과라도 돌려줄 수 있다. 반대면 플랫폼이
     먼저 끊어 아무것도 못 준다. */
  const budgetMs = number(source, "SYNC_BUDGET_MS");
  const maxDurationSeconds = number(route, "maxDuration");
  assert.ok(
    budgetMs < maxDurationSeconds * 1000,
    `전체 예산 ${budgetMs}ms가 라우트 상한 ${maxDurationSeconds}s를 넘어요`,
  );
});

test("호출당 대기가 남은 예산을 넘지 않는다", () => {
  // 기다려봐야 예산이 끝나면 소용이 없다.
  assert.match(
    source,
    /Math\.min\(TIMEOUTS\.githubSync,\s*remaining\)/u,
    "남은 예산으로 호출 대기를 자르지 않고 있어요",
  );
});

test("예산이 끝나면 멈추고 거기까지 돌려준다", () => {
  /* 동기화는 upsert만 하고 지우지 않으므로 부분 결과도 안전하다.
     아무것도 없는 것보다 낫고, 멈춘 사실은 로그로 남긴다. */
  assert.match(source, /remaining <= 0/u, "예산 소진을 확인하지 않아요");
  assert.match(source, /repository\.sync\.budget/u, "멈춘 사실을 기록하지 않아요");
});
