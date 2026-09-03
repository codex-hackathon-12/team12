import type { PortfolioContentDto, PortfolioStatementField } from "@/contracts/api-contract";
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

/** 되묻기로 다시 쓸 수 있는 자리. 이 목록 밖은 무슨 일이 있어도 바뀌지 않는다. */
export type RewritableField = PortfolioStatementField;

export type RewriteSlot = {
  repositoryName: string;
  field: RewritableField;
};

/** 모델이 돌려준 재작성. 요청하지 않은 자리도 올 수 있다고 보고 다룬다. */
export type ProjectRewrite = {
  repositoryName: string;
  role: string;
  highlights: string[];
  challenges: string[];
  solutions: string[];
  impact: string[];
};

export type RewriteResult = {
  content: PortfolioContentDto;
  /** 실제로 값이 바뀐 자리. 모델이 빈 값이나 같은 값을 돌려준 자리는 빠진다. */
  updatedFields: RewriteSlot[];
};

const ARRAY_LIMITS = {
  highlights: { count: CONTENT_LIMITS.highlights, length: TEXT_LIMITS.highlight },
  challenges: { count: CONTENT_LIMITS.challenges, length: TEXT_LIMITS.story },
  solutions: { count: CONTENT_LIMITS.solutions, length: TEXT_LIMITS.story },
  impact: { count: CONTENT_LIMITS.impact, length: TEXT_LIMITS.story },
} as const;

function cleanArray(value: unknown, field: keyof typeof ARRAY_LIMITS): string[] {
  const limits = ARRAY_LIMITS[field];
  const items = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  return clampTextArray(items.slice(0, limits.count), limits.length);
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

  /* 답이 있는 자리만 돈다. 모델 응답을 순회하지 않는 것이 핵심이다.
     응답을 순회하면 요청하지 않은 자리가 섞여 들어올 통로가 생긴다. */
  for (const slot of slots) {
    const rewrite = byName.get(slot.repositoryName);
    if (!rewrite) continue;

    const index = findProjectIndex(content, slot.repositoryName, urlByName);
    if (index === -1) continue;

    const project = projects[index];

    if (slot.field === "role") {
      const role = typeof rewrite.role === "string" ? clampText(rewrite.role.trim(), 60) : "";
      // 빈 값은 "근거가 없어 못 썼다"는 뜻이다. 기존 표현을 지우지 않는다.
      if (!role || role === project.role) continue;
      projects[index] = { ...project, role };
    } else {
      const value = cleanArray(rewrite[slot.field], slot.field);
      if (value.length === 0 || sameArray(value, project[slot.field])) continue;
      projects[index] = { ...project, [slot.field]: value };
    }

    updatedFields.push(slot);
  }

  if (updatedFields.length === 0) {
    return { content, updatedFields };
  }

  // 프로젝트 배열 외에는 원본을 그대로 넘긴다. 참조까지 같다.
  return { content: { ...content, projects }, updatedFields };
}
