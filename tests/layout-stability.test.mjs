import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

/**
 * 조작할 때 화면이 흔들리지 않는다는 약속을 지킨다.
 *
 * "픽셀이 안 움직인다"는 DOM 러너 없이 증명할 수 없다. 대신 **그것을 막고 있는
 * 장치가 제거되지 않았는지**를 지킨다. 흔들림은 전부 한 원인에서 왔다 — 폭과
 * 높이가 내용에 따라 정해지는데 내용이 상태에 따라 바뀐다는 것. 그래서 지킬
 * 것은 "예약해 둔 자리가 남아 있는가" 하나다.
 *
 * `tests/color-contrast.test.mjs`(CSS 문자열 파싱)와
 * `tests/copy-consistency.test.mjs`(.tsx 순회)의 방식을 그대로 쓴다.
 */

const root = new URL("..", import.meta.url).pathname;
const css = readFileSync(join(root, "app/globals.css"), "utf8");

/**
 * `선택자 { … }`에서 본문만 꺼낸다.
 *
 * 줄 첫머리에 붙은 것만 본다. 미디어 쿼리 안의 규칙은 들여쓰기가 있어 자연히
 * 걸러지고, `.settings-action .button`처럼 뒤에 붙은 형태도 섞이지 않는다.
 */
function block(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const match = css.match(new RegExp(`^${escaped}\\s*\\{([^}]*)\\}`, "mu"));
  assert.ok(match, `${selector} 규칙을 찾지 못했어요`);
  return match[1];
}

test("유령 라벨이 폭을 예약한다", () => {
  assert.match(block(".steady-label"), /display:\s*inline-grid/u);
  // 겹쳐야 칸 폭이 가장 넓은 문구를 따른다.
  assert.match(block(".steady-label > *"), /grid-area:\s*1\s*\/\s*1/u);

  const ghost = block(".steady-label-ghost");
  assert.match(ghost, /visibility:\s*hidden/u);
  /* display: none이면 폭을 주장하지 않아 예약이 통째로 사라진다. 보이지도
     않는데 왜 남겨두냐며 바꾸기 쉬운 자리라 못을 박는다. */
  assert.doesNotMatch(ghost, /display:\s*none/u);
});

test("컨트롤 높이를 한 곳에서 정한다", () => {
  /* .button과 확인 줄이 같은 값을 봐야 확인 줄이 버튼 자리를 넘겨받을 때
     행 높이가 안 변한다. 따로 적으면 갈라진다. */
  for (const token of ["--control-height", "--control-height-sm", "--confirm-height"]) {
    assert.match(css, new RegExp(`${token}:`, "u"), `${token} 토큰이 없어요`);
  }
  assert.match(block(".button"), /min-height:\s*var\(--control-height\)/u);
});

// [선택자, 설명]
const RESERVED = [
  [".result-actions", "결과 액션 행 — 확인 줄이 넘겨받아도 안 줄어들게"],
  [".result-actions > .delete-confirm", "결과 화면 확인 줄"],
  [".share-row", "공유 줄 — 비공개 확인으로 바뀔 때"],
  [".portfolio-list-actions", "목록 카드 액션 행"],
];

for (const [selector, label] of RESERVED) {
  test(`자리를 예약한다: ${label} (${selector})`, () => {
    const rule = block(selector);
    assert.match(rule, /min-height:\s*(var|calc)\(/u,
      `${selector}의 min-height가 없거나 토큰에서 파생하지 않아요`);
  });
}

test("공유 주소를 자르지 않는다", () => {
  /* 260px에서 잘려 끝이 안 보였다. 공유하려고 만든 주소인데 눈으로 확인할
     방법이 없었다. 자기 줄을 받았으니 자를 이유가 없다. */
  const rule = block(".share-url");
  assert.doesNotMatch(rule, /max-width/u, "주소에 폭 상한이 다시 생겼어요");
  assert.doesNotMatch(rule, /text-overflow/u, "주소를 말줄임으로 자르고 있어요");
});

test("쓰이지 않는 공유 상자 규칙이 남아 있지 않다", () => {
  assert.ok(!css.includes(".share-box"), ".share-box는 .share-row로 대체됐어요");
});

/* ── 소스 규칙 ─────────────────────────────────────────────── */

function collect(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry.startsWith(".")) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) collect(path, out);
    else if (entry.endsWith(".tsx")) out.push(path);
  }
  return out;
}

const sources = ["app", "components"]
  .flatMap((dir) => collect(join(root, dir)))
  .map((path) => ({ path: path.slice(root.length), text: readFileSync(path, "utf8") }));

const stripComments = (text) =>
  text.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/^\s*\/\/.*$/gmu, "");

test("진행 중 문구는 폭을 예약한 자리에서만 바뀐다", () => {
  /* 이게 이 파일에서 가장 값진 단언이다. 다음 사람이 새 버튼에 "저장 중…"을
     그냥 넣는 순간 막는다 — 지금 흔들림도 전부 그렇게 하나씩 쌓인 것이다. */
  const EXEMPT = [
    /* 이 둘은 버튼이 width: 100%라 문구 길이가 폭을 못 바꾼다. 재서 확인했다.
       유령을 씌우면 좁은 화면에서 오히려 넘칠 수 있다. */
    "app/(dashboard)/create/[id]/prompt/page.tsx",
    "app/(dashboard)/billing/page.tsx",
  ];

  const offenders = [];
  for (const { path, text } of sources) {
    if (EXEMPT.includes(path)) continue;
    /* 유령 목록 자체는 모듈 상수 배열로 둔다 — 그게 예약의 출처다.
       위반이 아니라 규약이므로 세지 않는다. */
    const body = stripComments(text).replace(/const\s+[A-Z_]+\s*=\s*\[[^\]]*\]/gu, "");
    for (const match of body.matchAll(/"[^"]*중…"/gu)) {
      /* 이 문구가 SteadyLabel 안에 있는지 본다. 앞으로 훑어 가장 가까운
         여는 태그가 SteadyLabel이면 예약된 자리다. */
      const before = body.slice(0, match.index);
      const tag = before.lastIndexOf("<");
      if (before.slice(tag, tag + 12) !== "<SteadyLabel") {
        offenders.push(`${path}: ${match[0]}`);
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `폭을 예약하지 않은 진행 문구가 있어요. SteadyLabel을 쓰세요:\n${offenders.join("\n")}`,
  );
});

test("유령 라벨은 자바스크립트로 폭을 재지 않는다", () => {
  /* 재려면 이펙트에서 상태를 바꿔야 하는데 React 19가 금지한다. 게다가 폰트
     로딩·확대·언어 변경에서 전부 틀린다. 측정은 CSS에게 맡긴 채로 둔다. */
  const source = readFileSync(join(root, "components/ui/SteadyLabel.tsx"), "utf8");
  for (const hook of ["useState", "useEffect", "useLayoutEffect", "useRef"]) {
    assert.ok(!source.includes(hook), `SteadyLabel이 ${hook}을 쓰고 있어요`);
  }
});

test("저장소 목록이 비었을 때 확인하지 않은 사실을 말하지 않는다", () => {
  /* 로그인은 저장소를 가져오지 않는다. 가져오는 건 새로고침을 누를 때뿐이라
     처음 온 사람에게는 이 화면이 늘 비어 있었는데, 화면은 "GitHub에 아직
     저장소가 없어요"라고 사실이 아닌 말을 하며 저장소를 만들라고 했다.
     비면 한 번 직접 가져와 보고, 그러고도 없을 때만 없다고 말해야 한다. */
  const page = readFileSync(join(root, "app/(dashboard)/repositories/page.tsx"), "utf8");
  assert.match(page, /stored\.length > 0/u, "저장된 목록이 비었을 때를 가르지 않고 있어요");
  assert.match(page, /syncRepositories\(\)/u, "비었을 때 GitHub에서 직접 가져오지 않고 있어요");
  // 못 가져온 것과 없는 것이 같은 문구를 쓰면 안 된다.
  assert.match(page, /syncError \?/u, "동기화 실패와 진짜 빈 상태를 가르지 않고 있어요");
});
