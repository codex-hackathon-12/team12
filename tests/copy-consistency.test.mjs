import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

/**
 * 문안 규칙을 사람의 기억이 아니라 빌드가 지키게 한다.
 *
 * 이번에 고친 것들 — 한 목적지에 라벨 다섯 개, 같은 사실을 말하는 다섯 문장,
 * 화면마다 다른 오류 복구 — 은 전부 "그때는 그게 자연스러워서" 생겼다. 다음에
 * 화면을 하나 더 만들 때도 똑같이 자연스러울 것이다. 규칙을 글로만 적어두면
 * 다시 갈라진다.
 */

const root = new URL("..", import.meta.url).pathname;

function collect(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry.startsWith(".")) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) collect(path, out);
    else if (entry.endsWith(".tsx")) out.push(path);
  }
  return out;
}

/* .tsx만 훑다가 공지 문구를 놓쳤다. 공지는 서버 데이터로 들어오지만 화면에
   그대로 나가는 문구라 규칙 대상이다. 화면 문구가 사는 곳은 컴포넌트만이
   아니라는 걸 이 파일이 기억해야 한다. */
const DATA_MODULES = [
  "server/content/catalog.ts",
  "mocks/api/fixtures/index.ts",
  "server/billing/mock-catalog.ts",
  "server/auth/github.ts",
  "lib/scopes.ts",
  "lib/api-client/adapters/http/index.ts",
];

const files = [
  ...["app", "components"].flatMap((dir) => collect(join(root, dir))),
  ...DATA_MODULES.map((path) => join(root, path)),
];
const sources = files.map((path) => ({ path: path.slice(root.length), text: readFileSync(path, "utf8") }));

/** 주석은 설명하는 글이라 규칙 대상이 아니다. 화면에 나가는 문자열만 본다. */
function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/^\s*\/\/.*$/gmu, "");
}

test("화면 문구는 해요체로 쓴다", () => {
  /* 근거: 토스 — "제품 안의 모든 문구는 해요체로, 상황·맥락을 불문하고."
     예외는 세 가지뿐이고, 전부 화면 문구가 아니다. */
  /* 처음에는 `습니다|입니다`만 봤다. 그 목록은 `정리합니다`·`제공됩니다`처럼
     흔한 어미를 통째로 놓쳤고, 실제로 프롬프트 화면의 설명 하나가 그 틈으로
     빠져나갔다. 어미를 나열하는 대신 종결형 `니다`를 본다. */
  const EXEMPT = [
    // 포트폴리오 본문은 사용자가 채용 담당자에게 보내는 산문이다. 문체가 다르다.
    "components/portfolio/PortfolioPreview.tsx",
    /* 목 픽스처의 포트폴리오 본문도 같은 이유로 제외한다. 다만 이 파일은 공지·
       상품 설명 같은 화면 문구도 함께 담고 있어, 파일 통째 예외로 두면 규칙이
       무의미해진다. 본문 산문만 골라 예외로 적는다. */
    // 검색 결과와 브라우저 탭에 쓰이는 제목.
    "app/p/[slug]/page.tsx",
    "app/layout.tsx",
  ];

  /* 목 픽스처 안의 포트폴리오 본문. 파일이 아니라 문장 단위로 예외를 둔다. */
  const EXEMPT_PROSE = [
    "사용자의 망설임을 줄이는 인터페이스를 만듭니다",
    "Git 저장소와 프롬프트를 바탕으로 취업 포트폴리오 초안을 만드는 서비스입니다",
    "화면과 데이터 계층을 분리하고, 작은 단위로 일관되게 개선해 온 저장소입니다",
    "팀이 보는 지표를 한 화면에 모으는 대시보드입니다",
  ];

  const offenders = [];
  for (const { path, text } of sources) {
    if (EXEMPT.includes(path)) continue;
    for (const [match] of stripComments(text).matchAll(/[^"'`<>{}\n]*(니다|하십시오)[^"'`<>{}\n]*/gu)) {
      if (EXEMPT_PROSE.some((prose) => match.includes(prose))) continue;
      offenders.push(`${path}: ${match.trim()}`);
    }
  }
  assert.deepEqual(offenders, [], `해요체가 아닌 문구가 있어요:\n${offenders.join("\n")}`);
});

test("목적지 이름은 lib/copy.ts에서만 정한다", () => {
  /* `/repositories` 하나를 가리키는 링크가 다섯 가지 이름을 쓰고 있었다.
     사용자는 그것들이 같은 곳인지 알 수 없다. */
  const offenders = [];
  for (const { path, text } of sources) {
    for (const [match] of stripComments(text).matchAll(/>\s*[^<>{}]*(포트폴리오 만들기|내 포트폴리오|대시보드|갤러리)[^<>{}]*</gu)) {
      offenders.push(`${path}: ${match.slice(1, -1).trim()}`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `목적지 이름을 직접 적은 곳이 있어요. LABEL을 쓰세요:\n${offenders.join("\n")}`,
  );
});

test("체험이라는 사실은 한 문장으로만 말한다", () => {
  const offenders = [];
  for (const { path, text } of sources) {
    const body = stripComments(text);
    if (path.endsWith("/lib/copy.ts")) continue;
    for (const [match] of body.matchAll(/[^"'`<>{}\n]*(차감되지 않|잔액 변동|Mock data|MVP에서는|mock 흐름)[^"'`<>{}\n]*/gu)) {
      offenders.push(`${path}: ${match.trim()}`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `체험 안내를 따로 쓴 곳이 있어요. MOCK_NOTE·MOCK_CHIP을 쓰세요:\n${offenders.join("\n")}`,
  );
});

test("로드 실패에 화면을 통째로 새로 열지 않는다", () => {
  /* 스크롤도, 다른 화면에 쓰던 입력도 함께 날아간다. 실패한 요청만 다시 보낸다. */
  const offenders = sources
    .filter(({ text }) => stripComments(text).includes("window.location.reload"))
    .map(({ path }) => path);
  assert.deepEqual(offenders, [], `window.location.reload()가 남아 있어요:\n${offenders.join("\n")}`);
});

test("로딩 문구는 한 동사만 쓴다", () => {
  /* 불러오다·준비하다·펼치다가 섞여 있었다. 같은 일에 다른 말을 쓰면 다른 일로 읽힌다. */
  const offenders = [];
  for (const { path, text } of sources) {
    for (const [, label] of stripComments(text).matchAll(/<LoadingState\s+label="([^"]+)"/gu)) {
      if (!label.endsWith("불러오고 있어요")) offenders.push(`${path}: ${label}`);
    }
  }
  assert.deepEqual(offenders, [], `로딩 문구가 갈라져 있어요:\n${offenders.join("\n")}`);
});
