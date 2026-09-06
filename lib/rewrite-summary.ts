import type {
  PortfolioContentDto,
  PortfolioProjectDto,
  PortfolioRewrittenFieldDto,
} from "@/contracts/api-contract";

/**
 * 되묻기 답변이 문서의 무엇을 바꿨는지 추린다.
 *
 * 서버는 새 `content`와 함께 `updatedFields`(바뀐 저장소·자리)를 돌려준다.
 * 계약이 그 값을 둔 이유도 그것이다 — *"무엇이 실제로 바뀌었는지는
 * `updatedFields`로 돌려주므로 화면이 그것만 짚어 보여줄 수 있다"*. 그런데
 * 화면은 길이만 세어 "문서의 그 자리를 채웠어요" 한 줄을 띄우고 값을 버렸다.
 * 바뀐 문장이 화면 밖이나 다른 A4 장에 있으면 아무 일도 안 일어난 것처럼
 * 보였다.
 *
 * 이전 값은 화면이 아직 들고 있다. 문서를 갈아끼우기 직전의 `content`와
 * 서버가 준 새 `content`를 같은 자리에서 견주면 "이전 → 지금"이 나온다.
 * 서버도 DB도 계약도 손대지 않는다.
 *
 * 외부 의존이 없는 순수 함수다.
 */

/** 화면이 한 덩어리로 말하는 자리. 결정 세 조각은 여기서 하나가 된다. */
export type RewriteSlotKind = "role" | "highlights" | "keyDecision";

export const SLOT_LABEL: Record<RewriteSlotKind, string> = {
  role: "역할",
  highlights: "강조",
  keyDecision: "핵심 결정",
};

/**
 * 무엇이 어떻게 바뀌었는지.
 *
 * `mode`가 없으면 화면이 거짓말을 하게 된다. 강조점은 답이 기존 항목 **뒤에
 * 붙는** 자리라 "이전"이 비어 있는데, 그걸 "비어 있었어요"로 읽으면 멀쩡히
 * 있던 문장 셋을 없던 것으로 만든다.
 */
export type RewriteChangeMode = "filled" | "replaced" | "added";

export type RewriteChange = {
  projectUrl: string;
  projectTitle: string;
  slot: RewriteSlotKind;
  mode: RewriteChangeMode;
  /** 바뀌기 전 문장. `mode`가 "replaced"일 때만 채워진다. */
  before: string[];
  after: string[];
};

/** 계약의 field를 화면이 말하는 자리로 옮긴다. 목록 밖은 다루지 않는다. */
const SLOT_OF: Record<string, RewriteSlotKind> = {
  role: "role",
  highlights: "highlights",
  decisionProblem: "keyDecision",
  decisionApproach: "keyDecision",
  decisionOutcome: "keyDecision",
};

function decisionLines(project: PortfolioProjectDto): string[] {
  const decision = project.keyDecision;
  return [decision.headline, decision.problem, decision.approach, decision.outcome]
    .filter((line) => line.trim().length > 0);
}

function sameLines(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((line, index) => line === right[index]);
}

export function summarizeRewrite(
  before: PortfolioContentDto,
  after: PortfolioContentDto,
  updatedFields: readonly PortfolioRewrittenFieldDto[],
  urlByName: ReadonlyMap<string, string>,
): RewriteChange[] {
  const changes: RewriteChange[] = [];
  const seen = new Set<string>();

  for (const field of updatedFields) {
    const slot = SLOT_OF[field.field];
    if (!slot || !field.repositoryName) continue;

    const url = urlByName.get(field.repositoryName);
    if (!url) continue;

    /* 결정 세 조각을 한 항목으로 접는다. `applyRewrite`는 답한 슬롯마다
       `updatedFields`를 밀어넣으므로 결정 하나에 세 줄이 온다. 접지 않으면
       문단 하나 바뀐 것을 "3곳 바뀜"이라고 말하게 된다. */
    const key = `${url} ${slot}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const was = before.projects.find((project) => project.repositoryUrl === url);
    const now = after.projects.find((project) => project.repositoryUrl === url);
    if (!now) continue;

    const oldLines = !was ? [] : slot === "role" ? [was.role] : slot === "highlights" ? was.highlights : decisionLines(was);
    const newLines = slot === "role" ? [now.role] : slot === "highlights" ? now.highlights : decisionLines(now);

    if (slot === "highlights") {
      /* 목록이라 통째로 견주면 안 바뀐 문장까지 "지금"에 섞여 무엇이 새것인지
         다시 알 수 없어진다. 늘어난 것과 사라진 것만 남긴다. */
      const added = newLines.filter((line) => !oldLines.includes(line));
      const removed = oldLines.filter((line) => !newLines.includes(line));
      if (added.length === 0 && removed.length === 0) continue;
      changes.push({
        projectUrl: url,
        projectTitle: now.title,
        slot,
        mode: removed.length > 0 ? "replaced" : "added",
        before: removed,
        after: added,
      });
      continue;
    }

    const filtered = newLines.filter((line) => line.trim().length > 0);
    // 빈 값은 "근거가 없어 못 썼다"는 뜻이라 병합이 버린다. 여기 올 일이 없다.
    if (filtered.length === 0 || sameLines(oldLines, newLines)) continue;

    const had = oldLines.filter((line) => line.trim().length > 0);
    changes.push({
      projectUrl: url,
      projectTitle: now.title,
      slot,
      mode: had.length > 0 ? "replaced" : "filled",
      before: had,
      after: filtered,
    });
  }

  return changes;
}
