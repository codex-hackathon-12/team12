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
    parts.push(...repository.ownCommits.flatMap((commit) => [commit.title, commit.body]));
    parts.push(...repository.teamCommitTitles);
    parts.push(...repository.ownPullRequests.flatMap((pull) => [pull.title, pull.body]));
    parts.push(...repository.teamPullRequestTitles);
    parts.push(...repository.topLevelPaths);
    /* 의존성은 지시문이 techStack의 근거로 쓰라고 안내하는 자리다. 여기 없으면
       "React를 쓰라"고 말해놓고 모델이 쓴 React를 검증이 도로 걷어낸다. */
    parts.push(...repository.dependencies);
  }
  // 사용자가 직접 적어 넣은 강조점도 근거로 인정한다. 본인이 주장하는 범위다.
  parts.push(...evidence.highlights);
  /* 되묻기에 지원자가 직접 답한 내용도 근거다. 저장소 근거와 나란한 사실 층으로
     쓰기로 해놓고 검증에서 빼면, 답변에만 나오는 기술이 조용히 사라진다. */
  for (const statement of evidence.applicantStatements ?? []) {
    parts.push(statement.answer);
  }
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

/**
 * 서술문에 지어낸 수치가 섞이는 것을 막는다.
 *
 * techStack과 skills는 이름 하나라 부분 문자열로 검증되지만, impact·challenges·
 * solutions·highlights는 문장이라 같은 방법이 통하지 않는다. 그래서 지금까지
 * 무검증이었다 — 환각 위험이 가장 큰 곳이 무방비였다.
 *
 * 문장 전체의 사실 여부는 코드가 판정할 수 없다. 대신 **수치 하나**만 본다.
 * AI 이력서의 붉은 깃발 1순위가 "지나치게 둥근 숫자"이고, 채용 담당자가 가장
 * 먼저 되묻는 것도 거기다. 지어낸 숫자는 후속 질문 하나에 무너지므로, 근거
 * 어디에도 없는 숫자가 들어간 문장은 통째로 뺀다.
 *
 * 판정은 보수적이다. 근거 payload 어디에도 그 숫자가 없을 때만 뺀다. 언어
 * 비율이든 의존성 버전이든 커밋 본문이든 한 번이라도 나오면 통과시킨다.
 * 정당한 문장을 지우는 쪽이 더 큰 손해이기 때문이다.
 */

/** 쉼표 자릿수 구분과 끝에 붙은 마침표를 걷어낸다. "1,200."과 "1200"은 같다. */
function normalizeNumber(value: string): string {
  return value.replace(/,/gu, "").replace(/\.+$/u, "");
}

/** 근거 쪽. 숫자로 보이는 것은 전부 담는다 — 인정할 수 있는 값이 많을수록 좋다. */
function extractNumbers(text: string): string[] {
  return [...text.matchAll(/\d[\d,]*(?:\.\d+)?/gu)]
    .map((match) => normalizeNumber(match[0]))
    .filter(Boolean);
}

/**
 * 문장 쪽. 수치 주장으로 읽히는 것만 담는다.
 *
 * 숫자가 있다고 다 주장이 아니다. 'N+1 질의', 'OAuth 2.0', 'S3', 'HTTP/2',
 * 'Next.js 15'는 기술 이름이다. 이것들까지 검사하면 정당한 문장이 통째로
 * 사라진다 — 실제로 'N+1 질의를 없앴다'가 먼저 걸렸다.
 *
 * 처음에는 글자에 붙었는지로 갈랐는데 'OAuth 2.0'처럼 띄어 쓰는 이름이 그대로
 * 빠져나갔다. 이름과 주장을 가르는 것은 앞이 아니라 **뒤**다. 주장에는 단위가
 * 붙는다 — 30%, 3배, 1,200명, 40분. 기술 이름에는 붙지 않는다.
 *
 * 그래서 단위가 따라오는 숫자만 검사한다. 지어낸 수치가 위험한 이유도 정확히
 * 그 단위 때문이다. 단위 없는 숫자는 채용 담당자가 되물을 주장이 아니다.
 */
const CLAIM_UNITS = [
  "%", "퍼센트", "배",
  "개월", "개", "명", "건", "회", "번", "곳", "팀",
  "밀리초", "초", "분", "시간", "일", "주", "달", "년",
  "만", "억", "천", "원", "달러",
  "ms", "MB", "GB", "KB", "TB",
].join("|");

function extractClaims(text: string): string[] {
  return [...text.matchAll(new RegExp(String.raw`(\d[\d,]*(?:\.\d+)?)\s*(?:${CLAIM_UNITS})`, "gu"))]
    .map((match) => normalizeNumber(match[1]))
    .filter(Boolean);
}

/**
 * 모델이 볼 수 있었던 숫자 전부.
 *
 * 근거 payload를 그대로 훑는다. "모델이 읽을 수 있었던 것"과 "검증이 인정하는
 * 것"이 정확히 같아야, 지시문이 쓰라고 한 값을 검증이 도로 걷어내는 일이
 * 생기지 않는다.
 *
 * `extraTexts`는 payload 밖에 있는 근거를 위한 자리다. 되묻기 답변이 그렇다 —
 * 저장된 근거 행에는 없지만 지원자가 직접 말한 사실이라 인정해야 한다.
 */
export function buildNumberSet(payload: string, extraTexts: string[] = []): Set<string> {
  return new Set(extractNumbers([payload, ...extraTexts].join(" ")));
}

export function verifyNarrative(
  sentences: string[],
  numbers: Set<string>,
): VerificationResult<string[]> {
  const value: string[] = [];
  const removed: string[] = [];

  for (const sentence of sentences) {
    const unsupported = extractClaims(sentence).some((number) => !numbers.has(number));
    if (unsupported) removed.push(sentence);
    else value.push(sentence);
  }

  return { value, removed };
}

export { buildHaystack };
