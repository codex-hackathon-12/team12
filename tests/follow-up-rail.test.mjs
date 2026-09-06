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
  /* 예전에는 그리드 컬럼(396px)을 `.result-page`에 만들어 카드를 담았다.
     그러면 카드가 아니라 툴바·공유 줄·꼬리말까지 전부 왼쪽으로 밀려 "질문 창
     전용 사이드바"가 생긴 꼴이 됐다. 나뉘는 것은 회색 캔버스 안뿐이다. */
  assert.doesNotMatch(css, /\.result-page\.with-rail/u, "카드 전용 컬럼이 되살아났어요");
  assert.doesNotMatch(css, /--rail-width/u, "컬럼 폭 변수가 남아 있어요");
  assert.doesNotMatch(resultPage, /result-main/u, "문서를 감싸는 래퍼가 되살아났어요");
});

test("카드가 이력서 오른쪽에 선다", () => {
  /* 절대 배치로 회색 여백에 겹쳐 띄우던 때는 A4 보기에서만 맞는 계산이었다.
     읽기 보기의 문서는 `.portfolio-preview`의 1120px이라 훨씬 넓어서, 폭이
     1560px을 넘으면 카드가 이력서 오른쪽을 덮었다. 칸을 나누면 종이가 자기
     칸 밖으로 나갈 수 없어 겹칠 방법이 사라진다. */
  const grid = css.match(
    /@media screen and \(min-width: (\d+)px\) \{\s*\.portfolio-canvas-wrap:has\(\.follow-up-rail\) \{([^}]*)\}/u,
  );
  assert.ok(grid, "캔버스를 두 칸으로 나누는 규칙이 없어요");
  assert.match(grid[2], /grid-template-columns:\s*minmax\(0, 1fr\) 336px/u, "칸이 둘이 아니에요");

  /* 종이 794 + 간격 16 + 카드 336 + 캔버스 좌우 24×2 = 1194. 이보다 좁으면
     나란히 설 수 없다. */
  assert.ok(Number(grid[1]) >= 1194, `분기점 ${grid[1]}px에서는 종이와 카드가 안 들어가요`);

  const rule = css.match(/\.follow-up-rail \{([^}]*)\}/u);
  assert.ok(rule, ".follow-up-rail 규칙이 없어요");
  assert.doesNotMatch(rule[1], /position: (?:sticky|fixed|absolute)/u, "칸 안에 서지 않아요");
});

test("인쇄를 폭 질의에 맡기지 않는다", () => {
  /* 인쇄할 때 크롬은 종이 폭(794px)으로 다시 배치해서 min-width 질의가 어차피
     걸리지 않지만, 그 우연에 기대면 안 된다 — 미리보기와 인쇄가 어긋났던
     사고가 정확히 그 우연에서 나왔다. 카드는 인쇄에서 display: none이어도
     DOM에 남으므로 `:has()`는 계속 맞고, 종이에 336px 칸이 생긴다. */
  const rule = new RegExp(String.raw`@media ([^{]*)\{\s*\.portfolio-canvas-wrap:has\(\.follow-up-rail\)`, "u");
  const found = css.match(rule);
  assert.ok(found, "캔버스를 나누는 질의를 못 찾았어요");
  assert.match(found[1], /screen and/u, "인쇄를 명시적으로 배제하지 않아요");
});

test("칸을 나눠도 문서가 접히지 않는다", () => {
  /* 읽기 보기의 문서는 `margin: 0 auto`로 가운데 정렬하는데, 자동 여백은
     그리드의 stretch를 이겨서 칸 안에서 fit-content로 줄어든다. 그리고 이
     문서는 컨테이너 질의로 크기가 갇혀 있어 fit-content가 0이다 — 실제로
     폭 2px에 높이 19000px짜리 띠로 접혔다. */
  assert.match(
    css,
    /:has\(\.follow-up-rail\) > \.portfolio-preview \{[^}]*width: 100%/u,
    "칸 안에서 문서 폭을 되돌리지 않아요",
  );
  assert.match(css, /container: result \/ inline-size/u,
    "컨테이너 선언이 사라졌다면 위 규칙의 이유도 다시 봐야 해요");
});

test("나란히 설 수 없으면 문서 아래로 내려온다", () => {
  /* 카드를 줄여서 억지로 옆에 두는 길도 있지만 그러면 대화가 읽히지 않는다. */
  assert.match(
    css,
    /@media \(max-width: 1199px\) \{[\s\S]*?\.follow-up-rail \{[^}]*margin: var\(--space-6\) auto 0/u,
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
  /* 지금 물을 것은 하나다 — 고쳐 쓰는 중이면 그 질문, 아니면 첫 미답. */
  assert.match(rail, /const current = editing/u, "지금 물을 것을 하나로 좁히지 않아요");
  assert.match(rail, /const pendingIndex = timeline\.findIndex/u, "다음 질문을 찾지 않아요");
});

test("대화 순서를 열 때 한 번 정한다", () => {
  /* 답할 때마다 목록을 다시 계산하면 방금 답한 질문이 빠지면서 자리가 밀려,
     다음 질문 하나가 통째로 건너뛰어진다. 답한 것도 함께 담아 고쳐 쓸 수
     있게 한다. */
  assert.match(rail, /useState\(\(\) => questions\)/u, "타임라인을 고정하지 않아요");
});

test("답을 다시 쓸 수 있다", () => {
  /* 서버는 질문 id로 답을 덮어쓰므로 재답변이 원래 가능했는데, 화면에 통로가
     없어 한 번 보내면 고칠 수 없었다. 답한 줄마다 통로를 둔다. */
  assert.match(rail, /className="follow-up-redo"/u, "답을 고칠 통로가 없어요");
  /* 건너뛰기와 클래스를 나눠 쓴다. 하나로 쓰면 "첫 번째 버튼"을 누르는 쪽이
     어느 것을 누를지 알 수 없어진다. */
  assert.doesNotMatch(rail, /className="follow-up-skip" type="button" onClick=\{onEdit\}/u);
  assert.match(rail, /const beginEdit =/u, "고쳐 쓰기 진입이 없어요");
  // 고쳐 쓰다 그만둘 길도 있어야 원래 자리로 돌아간다.
  assert.match(rail, /고쳐 쓰기 취소/u, "고쳐 쓰기를 그만둘 길이 없어요");
  // 답이 한 곳에 모여야 화면과 전송이 같은 값을 본다.
  assert.match(rail, /const \[answers, setAnswers\]/u, "답의 단일 출처가 없어요");
});

test("보낸 뒤 실패해도 쓴 답을 지우지 않는다", () => {
  /* 지우면 사용자가 방금 쓴 글을 잃는다. 남겨두면 "다시 답하기"로 그대로
     다시 보낼 수 있다. */
  assert.match(rail, /답은 화면에 남겨둔다/u);
});

test("결정 셋을 모아 한 번에 보낸다", () => {
  /* 결정은 셋이 모여야 문서에 들어간다. 한 조각만 보내면 서버는 나머지를
     모르는 채 재작성해 반쪽짜리가 된다 — 고쳐 쓸 때도 마찬가지라, 묶음을
     통째로 다시 보낸다. */
  assert.match(rail, /const group = groupOf\(current\);/u);
  assert.match(rail, /if \(batch\.length < group\.length\) \{/u, "덜 모인 채로 보내요");
  /* 덜 모였을 때도 화면은 무언가를 말해야 한다. 예전에는 여기서 그냥 돌아가
     아무 표시가 없었고, 사용자 눈에는 두 번 연속으로 답했는데 문서도 안
     바뀌고 설명도 없는 구간이 됐다. */
  assert.match(rail, /kind: "collecting"/u, "모으는 중을 말해주지 않아요");
  // 건너뛸 때도 묶음째. 셋 중 하나만 건너뛰면 나머지는 답해도 반영되지 않는다.
  assert.match(rail, /\.\.\.Object\.fromEntries\(group\.map/u, "건너뛰기가 묶음째가 아니에요");
});

test("답이 어디로 갔는지 말해준다", () => {
  /* 예전에는 성공했을 때 "문서의 그 자리를 채웠어요" 한 줄이 전부였다. 어느
     프로젝트의 어느 문단이 무엇에서 무엇으로 바뀌었는지는 어디에도 없었고,
     바뀐 문장이 화면 밖이나 다른 A4 장에 있으면 아무 일도 안 일어난 것처럼
     보였다. */
  assert.match(rail, /summarizeRewrite|RewriteChange/u, "무엇이 바뀌었는지 받지 않아요");
  assert.match(rail, /이전/u, "바뀌기 전 문장을 안 보여줘요");
  assert.match(rail, /문서에서 보기/u, "문서로 가는 길이 없어요");

  /* 이전 content를 아는 곳은 문서를 들고 있는 화면뿐이다. 카드는 보내고,
     화면이 무엇이 움직였는지 답한다. */
  assert.match(rail, /onApplied: \(result: PortfolioStatementResultDto\) => RewriteChange\[\]/u);
  assert.match(resultPage, /summarizeRewrite\(content, result\.content/u, "문서를 갈아끼운 뒤에 견주면 이전 값이 없어요");
});

test("보내는 동안과 못 바꿨을 때도 말해준다", () => {
  assert.match(rail, /kind: "writing"/u, "보내는 동안 아무 표시가 없어요");
  assert.match(rail, /loading-mark-inline/u, "진행 표시가 없어요");
  /* 못 바꾼 이유는 응답만으로 가릴 수 없다. 사용자를 탓하는 대신 규칙을
     말한다 — 수치 검증이 근거 없는 숫자를 지웠을 수도 있다. */
  assert.match(rail, /kind: "unchanged"/u);
  assert.doesNotMatch(rail, /조금 더 구체적으로 적어주시면 반영할 수 있어요/u, "사용자를 탓하는 문구가 남아 있어요");
});

test("바뀐 곳을 문서에도 짚는다", () => {
  assert.match(preview, /changedProjectUrls/u, "문서가 바뀐 곳을 안 받아요");
  assert.match(resultPage, /changedProjectUrls=\{/u, "결과 화면이 안 넘겨요");
  const rule = css.match(/\.result-block-changed \{([^}]*)\}/u);
  assert.ok(rule, ".result-block-changed 규칙이 없어요");
  // 자리를 차지하면 A4 나눔이 인쇄와 어긋난다. marked와 같은 이유다.
  assert.match(rule[1], /outline:/u);
  assert.doesNotMatch(rule[1], /border:|padding:/u, "표시가 자리를 차지해요");
});

test("문서 표시가 종이에 찍히지 않는다", () => {
  /* 주석에는 "인쇄에서 지운다"고 적혀 있었는데 규칙이 없었다. 패널을 열어둔
     채 인쇄하면 답할 것이 남은 프로젝트마다 점선 상자가 PDF에 찍혔다 —
     채용 담당자에게 보내는 파일에. */
  const print = printBlock();
  for (const mark of ["result-block-marked", "result-block-changed"]) {
    assert.match(print, new RegExp(`\\.${mark}`, "u"), `${mark}가 인쇄에서 안 지워져요`);
  }
  assert.match(print, /\.result-block-changed,?[\s\S]{0,80}outline: 0/u, "표시가 남아 있어요");
});

test("빈 자리를 직접 열 수 있다", () => {
  /* 되묻기 질문은 포트폴리오를 만들 때 한 번 생긴다. 모델이 어떤 저장소에
     대해 결정 묶음을 안 내면 그 프로젝트의 핵심 결정은 영영 빈 채로 남았다.
     답변에 "추가해줘"라고 써도 답은 그 질문의 자리 하나에만 반영된다. */
  assert.match(rail, /requestPortfolioQuestions/u, "자리를 여는 통로가 없어요");
  assert.match(rail, /follow-up-open/u, "빈 자리를 내미는 자리가 없어요");
  assert.match(resultPage, /openSlots/u, "어느 자리가 비었는지 안 넘겨요");

  /* 이미 질문이 있는 자리는 대화가 물을 테니 또 내밀지 않는다. */
  assert.match(rail, /const asked = new Set\(timeline\.map/u, "이미 물은 자리를 걸러내지 않아요");
});

test("연 질문이 지금 자리에 들어간다", () => {
  /* 맨 뒤에 붙이면 남은 질문을 다 답해야 자기가 연 질문에 닿는다. 그 자리를
     채우려고 누른 사람에게는 그게 곧 "안 열렸다"이다. */
  assert.match(rail, /setTimeline\(\(previous\) => \{/u, "대화 순서에 못 끼워 넣어요");
  assert.match(rail, /rest\.slice\(0, cut\), \.\.\.incoming/u, "새 질문을 맨 뒤에 붙여요");
});

test("한 프로젝트의 상한을 계약에서 가져온다", () => {
  /* 화면은 이 수보다 적을 때만 "강조 더 쓰기"를 내밀고 서버는 같은 조건으로
     자리를 열어준다. 두 곳에 따로 적으면 상한을 바꿀 때 한쪽만 남아 버튼이
     안 뜨거나 눌러도 거절당한다. */
  assert.match(resultPage, /PORTFOLIO_HIGHLIGHT_SLOTS/u);
  assert.doesNotMatch(resultPage, /highlights\.length < \d/u, "숫자를 직접 적었어요");
});

test("어느 결정을 쓸지 고를 수 있다", () => {
  /* 초안은 저장소에서 결정 하나를 스스로 골라 쓴다. 그게 지원자가 말하고
     싶은 결정이 아닐 수 있는데 바꿀 방법이 없었다. */
  assert.match(rail, /getDecisionCandidates/u, "후보를 안 물어봐요");
  assert.match(rail, /다른 결정으로/u, "이미 쓰인 결정을 바꿀 길이 없어요");
  assert.match(rail, /replace: choosing\.replace/u, "바꿔 쓰기가 서버에 안 전해져요");

  /* 후보가 없어도 막지 않는다. 근거가 남아 있지 않은 오래된 포트폴리오가
     있고, 후보를 못 뽑는 것과 결정을 못 쓰는 것은 다른 일이다. */
  assert.match(rail, /직접 쓸래요/u, "후보가 없으면 길이 막혀요");
  assert.match(rail, /candidates: \[\]/u, "후보를 못 불러오면 화면이 멈춰요");
});

test("바꿔 쓰면 이번에 연 자리만 지운다", () => {
  /* 서버가 그 질문들의 답을 비운다. 화면에 남겨두면 문서에 들어가지도 않을
     옛 답이 새 질문 아래에 붙어 있게 된다.

     범위가 넓으면 더 나쁘다. "서버가 답 없다고 한 것 전부"로 잡았더니 아까
     건너뛴 질문의 건너뜀까지 풀려 되살아났고, 그게 커서를 가로채 방금 고른
     결정 대신 엉뚱한 질문이 떠 있었다. */
  assert.match(rail, /if \(options\.replace\) \{/u);
  assert.match(rail, /!incomingIds\.has\(id\)/u, "이번에 연 자리만 지우지 않아요");
  assert.doesNotMatch(rail, /all\.filter\(\(question\) => !question\.answer\)/u, "범위가 다시 넓어졌어요");
});

test("연 것이든 바꾼 것이든 지금 묻는다", () => {
  /* 바꿔 쓴 질문은 이미 대화 뒤쪽에 있어서 그대로 두면 커서가 안 옮겨가고,
     방금 고른 결정 대신 엉뚱한 질문이 떠 있게 된다. */
  assert.match(rail, /const incoming = options\.replace/u);
  assert.match(rail, /filter\(\(question\) => !incomingIds\.has\(question\.id\)\)/u, "옮기지 않고 그 자리에 둬요");
});

test("바꿔 쓴 질문이 대화에도 반영된다", () => {
  /* id가 그대로라 "새로 생긴 것"에 안 잡힌다. 문구와 topic이 바뀌었으므로
     대화가 옛 질문을 계속 보여주면 안 된다. */
  assert.match(rail, /const changedIds = new Set\(all\.map/u);
  assert.match(rail, /changedIds\.has\(question\.id\)/u);
});

test("안 바뀐 이유를 추측하지 않는다", () => {
  /* 예전에는 답에 숫자가 있으면 규칙을 덧붙이는 추측이었다. 실제 원인이
     달랐을 때 사용자는 될 때까지 같은 답을 고쳐 쓰게 된다. */
  assert.doesNotMatch(rail, /answerHadNumber/u, "추측이 남아 있어요");
  assert.match(rail, /SKIP_MESSAGE\[result\.reason\]/u, "서버가 준 이유를 안 써요");
  // 사유마다 문구가 다 있어야 한다. 하나라도 빠지면 그 경우에 빈칸이 나온다.
  for (const reason of ["empty", "same", "incomplete", "numbers", "unavailable"]) {
    assert.match(rail, new RegExp(`${reason}:`, "u"), `${reason} 문구가 없어요`);
  }
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
