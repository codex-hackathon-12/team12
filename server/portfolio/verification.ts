import type { PortfolioEvidence } from "@/server/openai/portfolio-prompt";

/**
 * 근거에 없는 기술을 결과에서 걷어낸다.
 *
 * 프롬프트는 "확인되는 기술만 쓰라"고 지시하지만 지시는 강제가 아니다. 포트폴리오는
 * 신뢰가 상품이라, 근거를 못 찾은 항목은 표시해두는 대신 빼는 쪽을 택한다.
 * 채용 담당자가 물었을 때 설명하지 못하는 한 줄이 남는 것이 더 큰 손해다.
 *
 * 외부 의존이 없는 순수 함수다.
 */

export type SkillGroup = { category: string; skills: string[] };

/** 표기 차이를 흡수한다. "Next.js"와 "nextjs", "C++"와 "c"는 같은 것으로 본다. */
function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9가-힣]/gu, "");
}

function buildHaystack(evidence: PortfolioEvidence): string {
  const parts: string[] = [];
  for (const repository of evidence.repositories) {
    parts.push(repository.name, repository.description ?? "", repository.readme);
    parts.push(repository.primaryLanguage ?? "");
    parts.push(...repository.languages.map((language) => language.name));
    parts.push(...repository.ownCommitTitles, ...repository.teamCommitTitles);
    parts.push(...repository.ownPullRequests.flatMap((pull) => [pull.title, pull.body]));
    parts.push(...repository.teamPullRequestTitles);
    parts.push(...repository.topLevelPaths);
  }
  // 사용자가 직접 적어 넣은 강조점도 근거로 인정한다. 본인이 주장하는 범위다.
  parts.push(...evidence.highlights);
  return normalize(parts.join(" "));
}

/**
 * 한 글자짜리 항목은 검사하지 않는다. 어떤 문자열에도 걸려 검사가 무의미하고,
 * 반대로 지우면 정당한 항목까지 사라진다.
 */
function isSupported(haystack: string, value: string): boolean {
  const needle = normalize(value);
  return needle.length <= 1 || haystack.includes(needle);
}

export type VerificationResult<T> = {
  value: T;
  /** 걷어낸 항목. 얼마나 자주 일어나는지 봐야 프롬프트를 고칠 근거가 생긴다. */
  removed: string[];
};

export function verifyTechStack(
  techStack: string[],
  evidence: PortfolioEvidence,
  haystack = buildHaystack(evidence),
): VerificationResult<string[]> {
  const kept = techStack.filter((tech) => isSupported(haystack, tech));
  return {
    value: kept,
    removed: techStack.filter((tech) => !kept.includes(tech)),
  };
}

export function verifySkillGroups(
  groups: SkillGroup[],
  evidence: PortfolioEvidence,
  haystack = buildHaystack(evidence),
): VerificationResult<SkillGroup[]> {
  const removed: string[] = [];
  const value = groups
    .map((group) => {
      const skills = group.skills.filter((skill) => {
        const supported = isSupported(haystack, skill);
        if (!supported) removed.push(skill);
        return supported;
      });
      return { ...group, skills };
    })
    // 항목이 하나도 남지 않은 그룹은 제목만 남아 빈칸으로 보인다.
    .filter((group) => group.skills.length > 0);

  return { value, removed };
}

export { buildHaystack };
