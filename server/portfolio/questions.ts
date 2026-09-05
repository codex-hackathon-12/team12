import type { PortfolioStatementField } from "@/contracts/api-contract";

/**
 * 모델이 돌려준 되묻기 질문을 거른다.
 *
 * 질문을 만드는 것은 모델이지만, 물어도 되는 질문인지는 코드가 정한다. 모델이
 * 이미 채워진 자리를 물으면 사용자가 성심껏 답해도 아무것도 바뀌지 않고, 근거로
 * 쓰지 않은 저장소를 물으면 답을 붙일 자리가 없다. 둘 다 사용자가 시간을 쓴
 * 뒤에야 드러나는 실패라 미리 걸러야 한다.
 *
 * 외부 의존이 없는 순수 함수다.
 */

export type RawQuestion = {
  repositoryName: string;
  field: PortfolioStatementField;
  /** 결정 세 조각이 공유하는 한 줄. 낱개 질문은 빈 문자열이다. */
  topic: string;
  question: string;
};

export type SelectedQuestion = {
  repositoryName: string;
  field: SelectableField;
  topic: string | null;
  question: string;
};

/** 질문 대상이 되는 프로젝트의 현재 상태. 그 자리가 비어 있는지 판단한다. */
export type QuestionTarget = {
  repositoryName: string;
  highlights: string[];
  /** 초안이 결정을 채웠는지. 채웠으면 결정을 다시 묻지 않는다. */
  hasKeyDecision: boolean;
  /** 기여자 수. 혼자 만든 저장소에서는 역할을 물을 이유가 없다. */
  contributorCount: number;
  /** 본인 커밋을 하나도 확인하지 못한 상태. 역할이 실제로 불분명하다. */
  ownContributionUnverifiable: boolean;
};

/**
 * 상한.
 *
 * 상한이 없으면 저장소 세 개짜리에서 열 개 넘는 질문이 나오고, 그러면 사람은
 * 아무것도 답하지 않고 화면을 닫는다.
 *
 * 프로젝트당 결정 묶음 하나(3개)와 낱개 둘까지다. 결정 묶음은 화면에서 카드
 * 하나로 보이므로 사용자가 체감하는 질문 수는 프로젝트당 셋에 가깝다.
 */
export const MAX_QUESTIONS = 8;
export const MAX_SINGLE_QUESTIONS_PER_PROJECT = 2;

const QUESTION_MIN_LENGTH = 8;
export const QUESTION_MAX_LENGTH = 120;

/**
 * 결정을 이루는 세 조각. 순서가 곧 화면에 놓이는 순서다.
 *
 * 셋은 함께 남거나 함께 버려진다. 하나만 남으면 사용자가 답해도 결정이
 * 완성되지 않고, 반쪽짜리 결정은 문서에 넣지 않기 때문에 아무것도 안 바뀐다.
 * 답을 다 쓴 뒤에야 드러나는 실패라 여기서 막는다.
 */
const DECISION_FIELDS = ["decisionProblem", "decisionApproach", "decisionOutcome"] as const;

/** 결정 밖에서 낱개로 물을 수 있는 자리. */
const SINGLE_FIELDS = ["role", "highlights"] as const;

const FIELDS = [...DECISION_FIELDS, ...SINGLE_FIELDS] as const;

type SelectableField = (typeof FIELDS)[number];
type DecisionField = (typeof DECISION_FIELDS)[number];

function isSelectable(field: PortfolioStatementField): field is SelectableField {
  return (FIELDS as readonly string[]).includes(field);
}

function isDecisionField(field: SelectableField): field is DecisionField {
  return (DECISION_FIELDS as readonly string[]).includes(field);
}

/**
 * 그 자리가 실제로 비어 있는지 본다.
 *
 * role만 규칙이 다르다. role은 근거가 없어도 '프로젝트 개발'처럼 중립적인
 * 표현으로 항상 채워지므로 "비어 있음"으로는 판단할 수 없다. 대신 역할이 실제로
 * 불분명한 상황 — 다른 사람이 함께 만들었거나, 본인 커밋을 하나도 확인하지
 * 못한 경우 — 에만 묻는다.
 */
function isOpenSlot(target: QuestionTarget, field: SelectableField): boolean {
  if (field === "role") {
    return target.contributorCount > 1 || target.ownContributionUnverifiable;
  }
  if (isDecisionField(field)) {
    return !target.hasKeyDecision;
  }
  return target.highlights.length === 0;
}

export function selectFollowUpQuestions(
  questions: RawQuestion[],
  targets: QuestionTarget[],
): SelectedQuestion[] {
  /* 저장소 이름은 모델이 되받아 적은 문자열이라 대소문자나 공백이 어긋날 수
     있다. 정규화해 찾되, 저장은 근거에 있는 정확한 이름으로 한다. */
  const byName = new Map(
    targets.map((target) => [target.repositoryName.trim().toLowerCase(), target]),
  );

  const kept: Array<SelectedQuestion & { decision: boolean }> = [];
  const used = new Set<string>();
  const singlesPerProject = new Map<string, number>();

  for (const question of questions) {
    const target = byName.get(String(question.repositoryName ?? "").trim().toLowerCase());
    if (!target) continue;
    if (!isSelectable(question.field)) continue;
    const field = question.field;

    const text = String(question.question ?? "").trim();
    if (text.length < QUESTION_MIN_LENGTH || text.length > QUESTION_MAX_LENGTH) continue;
    if (!isOpenSlot(target, field)) continue;

    // 같은 자리를 두 번 묻지 않는다. DB의 유니크 인덱스와 같은 기준이다.
    const slot = `${target.repositoryName} ${field}`;
    if (used.has(slot)) continue;

    const decision = isDecisionField(field);
    if (!decision) {
      const count = singlesPerProject.get(target.repositoryName) ?? 0;
      if (count >= MAX_SINGLE_QUESTIONS_PER_PROJECT) continue;
      singlesPerProject.set(target.repositoryName, count + 1);
    }

    used.add(slot);
    kept.push({
      repositoryName: target.repositoryName,
      field,
      /* 결정 질문은 무엇에 대한 것인지 짚는 한 줄이 반드시 있어야 한다.
         낱개 질문에는 묶을 상대가 없으므로 null이다. */
      topic: decision ? String(question.topic ?? "").trim() || null : null,
      question: text,
      decision,
    });
  }

  return limit(dropIncompleteDecisions(kept));
}

/**
 * 세 조각이 다 모이지 않은 결정을 버린다.
 *
 * 하나만 남으면 사용자가 성심껏 답해도 결정이 완성되지 않고, 반쪽짜리 결정은
 * 문서에 넣지 않으므로 아무것도 바뀌지 않는다. 답을 다 쓴 뒤에야 드러나는
 * 실패라 여기서 막는다. topic이 없는 결정 질문도 같은 이유로 버린다 — 무엇에
 * 대한 질문인지 모르면 답할 수 없다.
 */
function dropIncompleteDecisions(
  questions: Array<SelectedQuestion & { decision: boolean }>,
): Array<SelectedQuestion & { decision: boolean }> {
  const groupKey = (item: SelectedQuestion) => `${item.repositoryName}\u0000${item.topic}`;
  const counts = new Map<string, number>();
  for (const item of questions) {
    if (!item.decision || !item.topic) continue;
    counts.set(groupKey(item), (counts.get(groupKey(item)) ?? 0) + 1);
  }

  return questions.filter((item) => {
    if (!item.decision) return true;
    return Boolean(item.topic) && counts.get(groupKey(item)) === DECISION_FIELDS.length;
  });
}

/**
 * 전체 상한을 건다.
 *
 * 묶음은 통째로 들어가거나 통째로 빠진다. 자르다 말면 앞에서 걸러낸 "반쪽짜리
 * 결정"이 상한 때문에 다시 생긴다.
 */
function limit(
  questions: Array<SelectedQuestion & { decision: boolean }>,
): SelectedQuestion[] {
  const result: SelectedQuestion[] = [];
  const takenGroups = new Set<string>();

  for (const item of questions) {
    const group = item.decision ? `${item.repositoryName}\u0000${item.topic}` : null;
    if (group && takenGroups.has(group)) {
      result.push({ repositoryName: item.repositoryName, field: item.field, topic: item.topic, question: item.question });
      continue;
    }

    const needed = group ? DECISION_FIELDS.length : 1;
    if (result.length + needed > MAX_QUESTIONS) continue;
    if (group) takenGroups.add(group);
    result.push({ repositoryName: item.repositoryName, field: item.field, topic: item.topic, question: item.question });
  }

  return result;
}
