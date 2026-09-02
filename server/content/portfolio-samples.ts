import type { PortfolioContentDto } from "@/contracts/api-contract";
import { PUBLIC_GITHUB_URL } from "@/server/content/links";

/**
 * 갤러리 예시의 포트폴리오 본문.
 *
 * 이 파일의 문장만 해요체 규칙에서 벗어난다. 여기 있는 글은 제품이 사용자에게
 * 하는 말이 아니라, 사용자가 채용 담당자에게 보내는 글이기 때문이다.
 *
 * 원래는 공지·갤러리 설명과 같은 파일에 있었다. 한 파일에 두 문체가 섞여 있으니
 * 파일 단위 예외가 화면 문구까지 덮어버렸고, 실제로 공지 세 건이 그 틈으로
 * 빠져나갔다. 예외가 정확히 예외인 것만 덮도록 갈라놓는다.
 */

export type GalleryExampleInput = {
  id: string;
  title: string;
  targetRole: string;
  description: string;
  techStack: string[];
  createdAt: string;
};

export function createPortfolioContent(input: GalleryExampleInput): PortfolioContentDto {
  const languagePercentage = Number((100 / input.techStack.length).toFixed(1));

  return {
    profile: {
      displayName: "folio.ai 공개 예시",
      headline: input.title,
      targetRole: input.targetRole,
      avatarUrl: null,
    },
    introduction: `${input.targetRole} 지원자가 프로젝트의 문제, 구현 선택과 배운 점을 정리하는 공개 포트폴리오 예시입니다.`,
    skills: [
      {
        category: "Core Skills",
        skills: [...input.techStack],
      },
    ],
    projects: [
      {
        id: `${input.id}_project`,
        title: `${input.targetRole} 프로젝트 구성 예시`,
        description: "공개된 예시 데이터를 바탕으로 포트폴리오 구성 방식을 보여줍니다.",
        repositoryUrl: PUBLIC_GITHUB_URL,
        role: input.targetRole,
        techStack: [...input.techStack],
        highlights: [
          "기술 선택과 구현 범위를 읽기 쉽게 구조화",
          "문제와 해결 과정을 한 프로젝트 흐름으로 정리",
        ],
        challenges: ["프로젝트의 핵심 맥락을 짧은 문장으로 전달해야 했습니다."],
        solutions: ["역할, 기술, 문제와 해결 과정을 분리해 설명했습니다."],
        impact: ["채용 담당자가 프로젝트의 기여 범위를 빠르게 파악할 수 있습니다."],
      },
    ],
    gitAnalysis: {
      summary: "운영자가 준비한 공개 포트폴리오 예시이므로 실제 GitHub 활동 지표는 포함하지 않습니다.",
      primaryLanguage: input.techStack[0] ?? null,
      languages: input.techStack.map((name) => ({ name, percentage: languagePercentage })),
      starCount: 0,
      forkCount: 0,
      notablePatterns: ["역할 중심 프로젝트 설명", "기술 스택의 맥락화", "문제 해결 흐름"],
    lastActivityAt: null,
    },
    contact: {
      githubUrl: PUBLIC_GITHUB_URL,
      email: null,
      location: null,
    },
  };
}
