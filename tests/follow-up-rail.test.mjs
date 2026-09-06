import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * 되묻기가 문서 옆에서 이뤄지는지 지킨다.
 *
 * 처음에는 비어 있는 자리에 카드를 직접 끼워 넣었다. 답이 어디로 가는지는
 * 분명했지만 읽는 대상 한가운데 편집 UI가 박혔고, A4 보기에서는 나눔이
 * 어긋나 아예 숨겨야 했다. 여기 걸린 것은 그 둘로 되돌아가는 것을 막는다.
 */

const root = new URL("..", import.meta.url).pathname;
const read = (path) => readFileSync(root + path, "utf8");

const rail = read("components/portfolio/FollowUpRail.tsx");
const documentView = read("components/portfolio/PortfolioDocument.tsx");
const preview = read("components/portfolio/PortfolioPreview.tsx");
const resultPage = read("app/(dashboard)/portfolios/[portfolioId]/page.tsx");
const css = read("app/globals.css");

function printBlock() {
  const start = css.search(/^@media print/mu);
  assert.notEqual(start, -1, "@media print 블록이 없어요");
  let depth = 0;
  for (let i = css.indexOf("{", start); i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    else if (css[i] === "}") {
      depth -= 1;
      if (depth === 0) return css.slice(start, i + 1);
    }
  }
  throw new Error("@media print 블록이 닫히지 않았어요");
}

test("문서 안에 편집 UI를 끼워 넣지 않는다", () => {
  /* 이력서 한가운데 입력 칸이 박히면 읽는 문서가 아니게 된다. 문서가 받는
     것은 "표시할 프로젝트" 목록뿐이다. */
  assert.doesNotMatch(preview, /renderProjectSlot/u, "문서에 요소를 끼우는 통로가 남아 있어요");
  assert.doesNotMatch(documentView, /renderProjectSlot/u, "문서에 요소를 끼우는 통로가 남아 있어요");
  assert.match(preview, /markedProjectUrls/u, "표시할 프로젝트를 받지 않아요");
});

test("A4 보기에서도 되묻기가 살아 있다", () => {
  /* 예전에는 화면 전용 카드가 나눔을 어긋나게 해서 A4 보기에서 되묻기를
     숨기고 읽기 보기를 강제로 열었다. 막다른 길을 가린 것이지 고친 것이
     아니었다. 패널이 문서 밖으로 나오면서 그 회피책이 필요 없어졌다. */
  assert.doesNotMatch(documentView, /hasOpenQuestions/u, "읽기 보기 강제가 남아 있어요");
  assert.match(documentView, /useState\(true\)/u, "A4 보기로 시작하지 않아요");
});

test("문서 표시가 자리를 차지하지 않는다", () => {
  /* border나 padding을 쓰면 블록 높이가 달라져 A4 나눔이 인쇄와 어긋난다.
     그것 때문에 예전에 되묻기를 숨겨야 했다. outline은 자리를 차지하지 않는다. */
  const rule = css.match(/\.result-block-marked\s*\{([^}]*)\}/u);
  assert.ok(rule, ".result-block-marked 규칙이 없어요");
  assert.match(rule[1], /outline:/u);
  assert.doesNotMatch(rule[1], /(?:^|[^-])(?:border|padding|margin)/u, "표시가 레이아웃을 건드려요");
});

test("숨은 측정 사본을 잡지 않는다", () => {
  /* A4 보기에서는 같은 data 속성이 DOM에 두 번 있다. 하나는 높이를 재려고
     화면 밖에 그려둔 사본이라, 그쪽을 잡으면 스크롤도 강조도 보이지 않는
     곳에서 일어난다. */
  assert.match(rail, /closest\("\.portfolio-pages-measure"\)/u, "측정 사본을 걸러내지 않아요");
});

test("남에게 보내는 문서에는 되묻기가 새어 나가지 않는다", () => {
  for (const path of ["app/p/[slug]/page.tsx", "app/(dashboard)/gallery/[exampleId]/page.tsx"]) {
    assert.doesNotMatch(read(path), /markedProjectUrls|FollowUpRail/u, `${path}가 되묻기를 넘기고 있어요`);
  }
  assert.match(resultPage, /markedProjectUrls=\{/u, "결과 화면이 표시를 안 넘겨요");
});

test("카드는 담기고, 안쪽은 칠하지 않는다", () => {
  /* 두 번 잘못 갔던 자리다. 슬래브(전부 칠함)도, 맨살 텍스트(아무것도 안
     담김)도 아니다. 노션 댓글처럼 카드 하나가 담고, 안의 말풍선·입력에는
     색을 채우지 않는다 — 누가 한 말인지는 아바타와 이름 줄이 말한다. */
  const rail = css.match(/\.follow-up-rail \{([^}]*)\}/u);
  assert.ok(rail, ".follow-up-rail 규칙이 없어요");
  assert.match(rail[1], /border-radius: 12px/u, "노션처럼 둥글지 않아요");
  assert.match(rail[1], /background: var\(--paper\)/u, "카드가 담기지 않아요");
  // 이 앱의 오프셋 하드 섀도가 아니라 노션의 부드러운 그림자다.
  assert.match(rail[1], /box-shadow: 0 4px 24px/u, "그림자가 카드답지 않아요");

  /* 카드 안에서 칠해도 되는 것은 아바타 원, 전송 버튼, 그리고 ::before로
     긋는 1px 스레드 선뿐이다 — 노션도 그 셋만 칠한다. 말풍선·입력·로그에
     면 색이 붙는 순간 다시 폼처럼 보인다. */
  const offenders = [];
  for (const match of css.matchAll(/(\.follow-up-[a-z-]+[^{}]*)\{([^}]*)\}/gu)) {
    const selector = match[1].trim();
    if (/^\.follow-up-rail$|follow-up-avatar|follow-up-send|::/u.test(selector)) continue;
    const fill = match[2].match(/background(?:-color)?:\s*([^;]+)/u);
    if (fill && !/transparent|none/u.test(fill[1])) offenders.push(`${selector} → ${fill[1].trim()}`);
  }
  assert.deepEqual(offenders, [], `말풍선 안쪽에 배경이 있어요:\n${offenders.join("\n")}`);
});

test("카드만을 위한 사이드바를 만들지 않는다", () => {
  /* 예전에는 그리드 컬럼(396px)을 하나 만들어 카드를 담았다. 그러면 카드가
     아니라 툴바·공유 줄·꼬리말까지 전부 왼쪽으로 밀려 "질문 창 전용
     사이드바"가 생긴 꼴이 됐다. 카드는 회색 여백에 겹쳐 뜬다. */
  assert.doesNotMatch(css, /\.result-page\.with-rail/u, "카드 전용 컬럼이 되살아났어요");
  assert.doesNotMatch(css, /--rail-width/u, "컬럼 폭 변수가 남아 있어요");

  const rule = css.match(/\.follow-up-rail \{([^}]*)\}/u);
  assert.ok(rule, ".follow-up-rail 규칙이 없어요");
  assert.match(rule[1], /position: absolute/u, "여백에 겹쳐 뜨지 않아요");
  assert.doesNotMatch(rule[1], /position: (?:sticky|fixed)/u);
});

test("카드가 이력서 윗변에서 시작한다", () => {
  /* 캔버스가 기준 상자이고 그 위쪽 여백이 곧 A4 종이 윗변이다. 같은 값을
     써야 계산 없이 맞는다 — 헤더 아래에서 시작하면 이력서보다 한참 위에
     떠 있게 된다. */
  const canvas = css.match(/\.portfolio-canvas-wrap \{([^}]*)\}/u);
  assert.ok(canvas, ".portfolio-canvas-wrap 규칙이 없어요");
  assert.match(canvas[1], /position: relative/u, "캔버스가 기준 상자가 아니에요");
  const pad = canvas[1].match(/padding:\s*(\d+)px/u);
  assert.ok(pad, "캔버스 위쪽 여백을 못 읽었어요");

  const rail = css.match(/\.follow-up-rail \{([^}]*)\}/u)[1];
  const top = rail.match(/top:\s*(\d+)px/u);
  assert.ok(top, "카드의 top이 없어요");
  assert.equal(top[1], pad[1], `카드 top(${top?.[1]})이 캔버스 여백(${pad[1]})과 달라요`);
});

test("여백이 모자라면 문서 아래로 내려온다", () => {
  /* 종이 오른쪽 여백은 화면 폭 W에 대해 W/2 - 397이다. 카드 336에 여백과
     간격을 더하면 1560px은 되어야 겹치지 않는다. 억지로 옆에 두면 카드가
     이력서를 덮는다. */
  assert.match(
    css,
    /@media \(max-width: 1559px\) \{[\s\S]*?\.follow-up-rail \{[^}]*position: static/u,
    "좁은 화면 폴백이 없어요",
  );
});

test("말풍선이 노션 댓글의 행 구조를 갖는다", () => {
  /* 행 = 아바타 + 이름 줄 + 본문. 묻는 쪽은 서비스 마크, 답한 쪽은 사용자
     아바타 — 누가 한 말인지 읽지 않고도 갈린다. 행 사이 스레드 선이 하나의
     대화임을 보인다. */
  assert.match(rail, /follow-up-avatar-bot/u, "묻는 쪽 아바타가 없어요");
  assert.match(rail, /profile\.avatarUrl/u, "답한 쪽이 사용자 아바타를 안 써요");
  assert.match(rail, /profile\.displayName/u, "답한 쪽 이름 줄이 없어요");
  assert.match(css, /\.follow-up-avatar \{[^}]*border-radius: 50%/u, "아바타가 원형이 아니에요");
  assert.match(css, /follow-up-ask:not\(:last-of-type\)::before/u, "스레드 연결선이 없어요");
});

test("회신 줄이 노션의 알약 입력이다", () => {
  /* 알약형 테두리 안에 입력과 원형 전송 버튼. 전송은 아이콘이라 문구 스왑이
     없어 전송 중에도 폭이 흔들리지 않는다. */
  const composer = css.match(/\.follow-up-composer \{([^}]*)\}/u);
  assert.ok(composer, ".follow-up-composer 규칙이 없어요");
  assert.match(composer[1], /border-radius: 18px/u, "알약형이 아니에요");
  const send = css.match(/\.follow-up-send \{([^}]*)\}/u);
  assert.ok(send, "전송 버튼 규칙이 없어요");
  assert.match(send[1], /border-radius: 50%/u, "전송 버튼이 원형이 아니에요");
  assert.match(rail, /aria-label="보내기"/u, "아이콘 버튼에 접근 가능한 이름이 없어요");
});

test("한 번에 하나만 묻는다", () => {
  /* 질문을 전부 펼친 폼이었을 때는 열 개가 넘으면 사람이 닫아버릴 것 같아
     물을 것을 8개로 묶어뒀다. 그러다 보니 저장소가 다섯이면 프로젝트마다
     한두 개밖에 못 물었다 — 폼을 유지하는 대가로 물을 것을 버린 셈이다. */
  assert.match(rail, /const current = queue\[cursor\] \?\? null;/u, "지금 물을 것을 하나로 좁히지 않아요");
  assert.match(rail, /setCursor\(cursor \+ 1\)/u, "다음 질문으로 넘어가지 않아요");
});

test("대화 순서를 열 때 한 번 정한다", () => {
  /* 답할 때마다 목록을 다시 계산하면 방금 답한 질문이 빠지면서 커서가
     가리키는 자리가 밀려, 다음 질문 하나가 통째로 건너뛰어진다. */
  assert.match(rail, /useState\(\(\) => questions\.filter\(\(question\) => !question\.answer\)\)/u);
});

test("결정 셋을 모아 한 번에 보낸다", () => {
  /* 결정은 셋이 모여야 문서에 들어간다. 폼이었을 때는 "세 가지를 다
     알려주셔야" 하고 되돌려 보내야 했던 일이 대화에서는 그냥 순서가 된다. */
  assert.match(rail, /if \(!isGroupComplete\(current, cursor\)\) \{/u);
  assert.match(rail, /pending\.current = \[\.\.\.pending\.current,/u, "모으지 않고 바로 보내요");
  // 건너뛸 때도 묶음째. 셋 중 하나만 건너뛰면 나머지는 답해도 반영되지 않는다.
  assert.match(rail, /while \(queue\[next\] && sameDecision\(current, queue\[next\]\)\) next \+= 1;/u);
});

test("보내지 못한 답을 잃지 않는다", () => {
  // 실패했다고 모아둔 것을 버리면 결정 세 개를 처음부터 다시 답해야 한다.
  assert.match(rail, /pending\.current = batch;/u, "실패 시 모아둔 답을 되돌리지 않아요");
});

test("한글을 쓰는 중에 Enter로 보내지 않는다", () => {
  /* 조합 중의 Enter는 글자를 확정하는 키다. 그때 보내면 쓰던 글자가 잘린
     채로 나간다. */
  assert.match(rail, /!event\.nativeEvent\.isComposing/u, "조합 중 Enter를 걸러내지 않아요");
});

test("닫은 대화를 다시 열 수 있다", () => {
  /* 예전에는 "답할 것 N개"라고만 적어 개수를 알리는 배지처럼 보였다. 누를 수
     있는 것으로 읽히지 않아 한 번 닫으면 다시 못 여는 화면이 됐다. */
  assert.match(resultPage, /aria-expanded=\{railOpen\}/u, "여닫는 버튼이 상태를 알리지 않아요");
  assert.match(resultPage, /질문 \$\{openQuestions\.length\}개 답하기/u, "무엇을 하는 버튼인지 동사로 적지 않았어요");
  // 답을 다 한 뒤에도 무엇을 답했는지 다시 볼 수 있어야 한다.
  assert.match(resultPage, /답한 질문 보기/u);
  assert.match(resultPage, /railQuestions\.length > 0 \? \(/u, "답을 다 하면 버튼이 사라져요");
});

test("패널이 종이에 찍히지 않는다", () => {
  assert.match(printBlock(), /\.follow-up-rail,/u, "패널이 인쇄에서 숨겨지지 않아요");
});

test("진행 표시를 반드시 되돌린다", () => {
  assert.match(rail, /\} finally \{\s*(?:\/\*[\s\S]*?\*\/\s*)?setSubmitting\(false\);/u);
});

test("답변 상한을 계약에서 가져온다", () => {
  assert.match(rail, /PORTFOLIO_ANSWER_MAX_LENGTH/u);
  assert.doesNotMatch(rail, /600/u, "상한 숫자를 화면에 직접 적었어요");
});

test("수치를 요구하지 않는다", () => {
  assert.match(rail, /수치가 없어도 괜찮아요/u);
});
