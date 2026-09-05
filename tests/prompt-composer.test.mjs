import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * 프롬프트 조립기.
 *
 * 백지에 "무엇을 강조할지 적어주세요"라고 두면 대부분 아무것도 못 적거나
 * "잘 써주세요"라고 적는다. 고르면 시작점이 생기되, 고쳐 쓴 글을 빼앗지
 * 않아야 한다 — 그게 이 화면에서 가장 잃기 쉬운 것이다.
 */

const { PROMPT_DIRECTIONS, composePrompt } = await import(
  new URL("../lib/prompt-presets.ts", import.meta.url)
);

const root = new URL("..", import.meta.url).pathname;
const page = readFileSync(root + "app/(dashboard)/create/[id]/prompt/page.tsx", "utf8");

test("고른 순서가 아니라 목록 순서로 잇는다", () => {
  /* 같은 조합이면 언제나 같은 문장이 나와야 한다. 고른 순서를 따르면 체크를
     껐다 켜는 것만으로 글이 뒤섞여, 사용자는 자기가 무엇을 건드렸는지 잃는다. */
  const ids = PROMPT_DIRECTIONS.map((direction) => direction.id);
  const forward = composePrompt([ids[0], ids[2]]);
  const backward = composePrompt([ids[2], ids[0]]);
  assert.equal(forward, backward);
  assert.ok(forward.indexOf(PROMPT_DIRECTIONS[0].sentence) < forward.indexOf(PROMPT_DIRECTIONS[2].sentence));
});

test("고르지 않으면 빈 문장이다", () => {
  // 아무것도 안 고른 사람에게 남의 문장이 들어가 있으면 안 된다.
  assert.equal(composePrompt([]), "");
});

test("모르는 항목은 조용히 무시한다", () => {
  assert.equal(composePrompt(["없는-항목"]), "");
});

test("선택지가 사실이 아니라 순서를 말한다", () => {
  /* 이 칸이 정하는 것은 무엇을 앞에 둘지이지 사실이 아니다. 선택지가 성과나
     수치를 약속하면 사용자는 없는 사실이 생길 것으로 기대하게 된다. */
  for (const direction of PROMPT_DIRECTIONS) {
    assert.doesNotMatch(direction.sentence, /\d+\s*(?:%|배|명)/u, `${direction.id}가 수치를 말해요`);
  }
});

test("고른 것마다 무엇이 달라지는지 알려준다", () => {
  // 고르기 전에 알아야 고를 수 있다.
  for (const direction of PROMPT_DIRECTIONS) {
    assert.ok(direction.label.trim(), "이름이 없어요");
    assert.ok(direction.hint.trim(), `${direction.id}에 설명이 없어요`);
    assert.ok(direction.sentence.trim(), `${direction.id}에 문장이 없어요`);
  }
});

test("직접 고쳐 쓴 글을 체크 한 번에 날려버리지 않는다", () => {
  /* 여기가 이 화면에서 가장 잃기 쉬운 것이다. 애써 고친 문장이 체크박스
     하나에 사라지면 다시는 이 칸을 믿지 않는다. */
  assert.match(page, /if \(!edited\) setPrompt\(composePrompt\(next\)\);/u, "손댄 뒤에도 덮어써요");
  assert.match(page, /setEdited\(event\.target\.value !== composePrompt\(directions\)\)/u);
  // 대신 되돌릴 길은 남긴다.
  assert.match(page, /고른 방향대로 다시 만들기/u, "되돌릴 방법이 없어요");
});

test("직접 쓰는 길을 막지 않는다", () => {
  // 선택지는 시작점이지 관문이 아니다.
  assert.match(page, /여기에 직접 적어주세요/u, "직접 쓸 수 있다고 말하지 않아요");
});
