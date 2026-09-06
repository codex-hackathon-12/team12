import type {
  PortfolioContentDto,
  PortfolioSkipReason,
  PortfolioStatementField,
} from "@/contracts/api-contract";
import { CONTENT_LIMITS, TEXT_LIMITS, clampText, clampTextArray } from "@/server/portfolio/content-limits";

/**
 * 답한 자리만 다시 쓴다.
 *
 * 사용자에게 한 약속은 "답한 부분만 바뀐다"이다. 전체를 다시 만들면 마음에 들던
 * 문장까지 바뀌어 답할 이유가 없어진다. 그런데 프롬프트에 "다른 곳은 건드리지
 * 마세요"라고 적는 것은 지시일 뿐 강제가 아니다. 모델은 요청하지 않은 자리도
 * 곧잘 돌려준다.
 *
 * 그래서 이 약속은 여기서 지킨다. 실제로 답이 있는 자리만 병합하고, 나머지는
 * 모델이 무엇을 돌려줬든 버린다. 제목, 헤드라인, 소개, 역량, 기술 스택, Git
 * 분석, 연락처는 이 함수가 아예 읽지 않는다.
 *
 * 외부 의존이 없는 순수 함수다.
 */

/**
 * 되묻기로 다시 쓸 수 있는 자리. 이 목록 밖은 무슨 일이 있어도 바뀌지 않는다.
 *
 * 계약의 `PortfolioStatementField`보다 좁다. 결정 질문(decisionProblem 등)은
 * 셋이 모여야 하나의 결정이 되므로 낱개 병합 규칙으로 다룰 수 없다. 여기 없는
 * field는 슬롯이 되지 못하고, 슬롯이 아니면 병합도 없다.
 */
export const REWRITABLE_FIELDS = [
  "role",
  "highlights",
  "decisionProblem",
  "decisionApproach",
  "decisionOutcome",
] as const;

/** 결정을 이루는 세 조각. 셋이 다 답해질 때만 결정이 문서에 들어간다. */
export const DECISION_FIELDS = ["decisionProblem", "decisionApproach", "decisionOutcome"] as const;

export type RewritableField = (typeof REWRITABLE_FIELDS)[number];

export function isRewritableField(field: PortfolioStatementField): field is RewritableField {
  return (REWRITABLE_FIELDS as readonly string[]).includes(field);
}

export type RewriteSlot = {
  repositoryName: string;
  field: RewritableField;
};

/** 모델이 돌려준 재작성. 요청하지 않은 자리도 올 수 있다고 보고 다룬다. */
export type ProjectRewrite = {
  repositoryName: string;
  role: string;
  highlights: string[];
  keyDecision: {
    headline: string;
    problem: string;
    approach: string;
    outcome: string;
  };
};

/**
 * 답했는데 바뀌지 않은 자리와 그 이유.
 *
 * 왜 버렸는지는 여기서만 알 수 있다. 화면에 넘기지 않으면 안내가 "조금 더
 * 구체적으로 적어주시면"이라는 추측이 되고, 실제 원인이 다른 것이었을 때
 * 사용자는 될 때까지 같은 답을 고쳐 쓰게 된다.
 */
export type RewriteSkip = RewriteSlot & { reason: PortfolioSkipReason };

export type RewriteResult = {
  content: PortfolioContentDto;
  /** 실제로 값이 바뀐 자리. 모델이 빈 값이나 같은 값을 돌려준 자리는 빠진다. */
  updatedFields: RewriteSlot[];
  skippedFields: RewriteSkip[];
};

function cleanHighlights(value: unknown): string[] {
  const items = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  return clampTextArray(items.slice(0, CONTENT_LIMITS.highlights), TEXT_LIMITS.highlight);
}

const DECISION_LIMITS = {
  headline: TEXT_LIMITS.decisionHeadline,
  problem: TEXT_LIMITS.decisionProblem,
  approach: TEXT_LIMITS.decisionApproach,
  outcome: TEXT_LIMITS.decisionOutcome,
} as const;

function cleanDecision(value: unknown): PortfolioContentDto["projects"][number]["keyDecision"] | null {
  const source = (value ?? {}) as Record<string, unknown>;
  const read = (key: keyof typeof DECISION_LIMITS) =>
    typeof source[key] === "string" ? clampText((source[key] as string).trim(), DECISION_LIMITS[key]) : "";

  const decision = {
    headline: read("headline"),
    problem: read("problem"),
    approach: read("approach"),
    outcome: read("outcome"),
  };
  /* 한 조각이라도 비면 반영하지 않는다. 문제만 있고 선택이 없는 문단은
     면접관에게 아무것도 말해주지 않고, 지원자는 자기가 답한 것이 왜 저렇게
     나왔는지 알 수 없다. */
  return Object.values(decision).every(Boolean) ? decision : null;
}

function sameArray(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

/**
 * 프로젝트를 저장소 URL로 찾는다.
 *
 * 저장된 결과에는 저장소 이름이 없다. `PortfolioProjectDto`는 화면에 필요한
 * 것만 담아 `repositoryUrl`만 남기기 때문이다. 근거의 이름→URL 대응을 거쳐
 * 찾으면 저장된 데이터만으로 연결할 수 있다.
 */
function findProjectIndex(
  content: PortfolioContentDto,
  repositoryName: string,
  urlByName: Map<string, string>,
): number {
  const url = urlByName.get(repositoryName);
  if (!url) return -1;
  return content.projects.findIndex((project) => project.repositoryUrl === url);
}

export function applyRewrite(
  content: PortfolioContentDto,
  rewrites: ProjectRewrite[],
  slots: RewriteSlot[],
  urlByName: Map<string, string>,
): RewriteResult {
  const byName = new Map(rewrites.map((rewrite) => [rewrite.repositoryName, rewrite]));
  const projects = [...content.projects];
  const updatedFields: RewriteSlot[] = [];
  const skippedFields: RewriteSkip[] = [];
  const skip = (slot: RewriteSlot, reason: PortfolioSkipReason) => {
    skippedFields.push({ ...slot, reason });
  };

  /* 답이 있는 자리만 돈다. 모델 응답을 순회하지 않는 것이 핵심이다.
     응답을 순회하면 요청하지 않은 자리가 섞여 들어올 통로가 생긴다. */
  for (const slot of slots) {
    const rewrite = byName.get(slot.repositoryName);
    if (!rewrite) {
      skip(slot, "unavailable");
      continue;
    }

    const index = findProjectIndex(content, slot.repositoryName, urlByName);
    if (index === -1) {
      skip(slot, "unavailable");
      continue;
    }

    const project = projects[index];

    if (slot.field === "role") {
      const role = typeof rewrite.role === "string" ? clampText(rewrite.role.trim(), 60) : "";
      // 빈 값은 "근거가 없어 못 썼다"는 뜻이다. 기존 표현을 지우지 않는다.
      if (!role) {
        skip(slot, "empty");
        continue;
      }
      if (role === project.role) {
        skip(slot, "same");
        continue;
      }
      projects[index] = { ...project, role };
    } else if (slot.field === "highlights") {
      const value = cleanHighlights(rewrite.highlights);
      if (value.length === 0) {
        skip(slot, "empty");
        continue;
      }
      if (sameArray(value, project.highlights)) {
        skip(slot, "same");
        continue;
      }
      projects[index] = { ...project, highlights: value };
    } else {
      /* 결정 세 조각은 하나의 값이다. 슬롯이 셋이어도 결정은 한 번만 쓴다 —
         같은 값을 세 번 덮어쓰면 두 번째부터는 "바뀐 것"으로 세어져, 화면이
         실제보다 많이 바뀌었다고 말하게 된다. */
      const decision = cleanDecision(rewrite.keyDecision);
      /* 네 값 중 하나라도 비면 결정을 통째로 버린다. 답한 사람에게는
         "셋이 다 있어야 한다"가 아니라 "아무 일도 안 일어났다"로 보이므로
         사유를 남긴다. */
      if (!decision) {
        skip(slot, "incomplete");
        continue;
      }
      if (projects[index].keyDecision.headline !== decision.headline
        || projects[index].keyDecision.problem !== decision.problem
        || projects[index].keyDecision.approach !== decision.approach
        || projects[index].keyDecision.outcome !== decision.outcome) {
        projects[index] = { ...projects[index], keyDecision: decision };
      } else if (updatedFields.some((done) => done.repositoryName === slot.repositoryName
        && DECISION_FIELDS.includes(done.field as (typeof DECISION_FIELDS)[number]))) {
        // 같은 결정의 다른 조각으로 이미 반영됐다. 그 조각도 답한 자리이므로 함께 센다.
        updatedFields.push(slot);
        continue;
      } else {
        skip(slot, "same");
        continue;
      }
    }

    updatedFields.push(slot);
  }

  if (updatedFields.length === 0) {
    return { content, updatedFields, skippedFields };
  }

  // 프로젝트 배열 외에는 원본을 그대로 넘긴다. 참조까지 같다.
  return { content: { ...content, projects }, updatedFields, skippedFields };
}
