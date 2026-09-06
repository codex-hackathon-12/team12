import type { PortfolioDecisionCandidateDto } from "@/contracts/api-contract";
import type { PortfolioEvidenceRepository } from "@/server/openai/portfolio-prompt";

/**
 * 저장소에서 "말할 만한 결정" 후보를 고른다.
 *
 * 초안이 결정을 고르는 일은 모델이 한다. 그런데 무엇이 말할 만한 결정인지는
 * 만든 사람이 안다. 여기서는 판단하지 않고 **저장소에 실제로 남아 있는 것을
 * 그대로 내민다** — 본인 PR과 커밋 제목이다.
 *
 * 제목을 다듬지 않는다. 생성 지침이 말하는 topic이 원래 "커밋 제목, 함수
 * 이름, 파일 경로처럼 지원자가 '아, 그거' 하고 떠올릴 수 있는 것"이라,
 * 매끄럽게 고쳐 쓰면 오히려 못 알아본다.
 *
 * 모델을 부르지 않는다. 순위는 규칙으로 정한다.
 *
 * 외부 의존이 없는 순수 함수다.
 */

/** 한 번에 보여줄 수 있는 수. 더 늘리면 고르는 일 자체가 일이 된다. */
export const MAX_DECISION_CANDIDATES = 6;

const TITLE_MIN_LENGTH = 6;
const TITLE_MAX_LENGTH = 80;

/**
 * 결정이 아닌 것.
 *
 * 병합 커밋은 사람이 쓴 문장이 아니고, 잡일 커밋은 판단이 없었던 변경이다.
 * 이런 것을 섞어 내밀면 목록을 훑는 동안 진짜 후보가 묻힌다.
 */
const NOISE = [
  /^merge\b/iu,
  /^revert\b/iu,
  /^(chore|docs|style|test|ci|build)(\(|:)/iu,
  /^(wip|temp|tmp)\b/iu,
  /^(initial commit|first commit)$/iu,
  /^(update|fix|add|remove|delete|cleanup|refactor|bump|typo)[\s.!]*$/iu,
  /^v?\d+\.\d+/u,
];

function isNoise(title: string): boolean {
  return NOISE.some((pattern) => pattern.test(title));
}

function clean(title: string): string {
  // 제목 한 줄만 쓴다. 본문이 붙어 온 경우 첫 줄이 제목이다.
  return title.split("\n")[0].trim();
}

function usable(title: string): boolean {
  return title.length >= TITLE_MIN_LENGTH && title.length <= TITLE_MAX_LENGTH && !isNoise(title);
}

/**
 * 순위.
 *
 * 본문이 있는 것이 먼저다. 본문은 "왜"가 적히는 자리라 지원자가 그 결정을
 * 설명하기 쉽고, 애초에 본문을 쓸 만큼 판단이 있었던 변경이라는 뜻이기도
 * 하다. PR은 커밋보다 큰 단위라 그다음에 둔다.
 */
function rank(candidate: PortfolioDecisionCandidateDto): number {
  if (candidate.hasContext) return candidate.source === "pullRequest" ? 0 : 1;
  return candidate.source === "pullRequest" ? 2 : 3;
}

export function selectDecisionCandidates(
  repository: PortfolioEvidenceRepository,
): PortfolioDecisionCandidateDto[] {
  const found: PortfolioDecisionCandidateDto[] = [];
  const seen = new Set<string>();

  const push = (rawTitle: string, source: "commit" | "pullRequest", body: string) => {
    const topic = clean(rawTitle ?? "");
    if (!usable(topic)) return;
    // 같은 제목이 PR과 커밋 양쪽에 있는 일이 흔하다. 두 번 내밀지 않는다.
    const key = topic.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    found.push({ topic, source, hasContext: (body ?? "").trim().length > 0 });
  };

  for (const pull of repository.ownPullRequests ?? []) push(pull.title, "pullRequest", pull.body);
  for (const commit of repository.ownCommits ?? []) push(commit.title, "commit", commit.body);

  /* 정렬은 안정적이어야 한다. 같은 순위 안에서는 저장소에서 읽은 순서를
     지켜야 두 번 열어도 목록이 흔들리지 않는다. */
  return found
    .map((candidate, index) => ({ candidate, index }))
    .sort((a, b) => rank(a.candidate) - rank(b.candidate) || a.index - b.index)
    .slice(0, MAX_DECISION_CANDIDATES)
    .map((entry) => entry.candidate);
}
