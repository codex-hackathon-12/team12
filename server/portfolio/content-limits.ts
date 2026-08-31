/**
 * 결과 화면이 감당할 수 있는 분량 상한.
 *
 * 배열 상한은 생성 스키마에도 있지만, 문자열 길이는 프롬프트 문장으로만 존재해
 * 모델이 어겨도 걸러지지 않았다. 저장할 때와 읽을 때 양쪽에서 자른다.
 */

export const CONTENT_LIMITS = {
  skillGroups: 5,
  skillsPerGroup: 8,
  techStack: 10,
  highlights: 4,
  challenges: 3,
  solutions: 3,
  impact: 3,
  notablePatterns: 4,
} as const;

/** 프롬프트가 안내하는 값과 같다. 두 곳이 어긋나면 잘림이 눈에 띄게 된다. */
export const TEXT_LIMITS = {
  headline: 80,
  introduction: 220,
  description: 160,
  highlight: 70,
  story: 90,
} as const;

/**
 * 서로게이트 페어를 쪼개지 않도록 코드 포인트 단위로 자른다.
 * 그냥 slice하면 이모지가 반 토막 나 깨진 글자가 남는다.
 */
export function clampText(value: string, limit: number): string {
  const characters = [...value];
  if (characters.length <= limit) {
    return value;
  }
  return `${characters.slice(0, Math.max(1, limit - 1)).join("").trimEnd()}…`;
}

export function clampTextArray(values: string[], limit: number): string[] {
  return values.map((value) => clampText(value, limit));
}
