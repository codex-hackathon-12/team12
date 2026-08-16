import type {
  GenerationStage,
  GenerationStatus,
} from "@/contracts/api-contract";

export interface GenerationScenarioStep {
  status: GenerationStatus;
  stage: GenerationStage;
  progress: number;
  message: string;
}

export const successfulGenerationScenario = [
  {
    status: "queued",
    stage: "queued",
    progress: 8,
    message: "생성 요청을 안전하게 접수했어요.",
  },
  {
    status: "processing",
    stage: "analyzingRepository",
    progress: 32,
    message: "README와 코드 구조에서 핵심 경험을 찾고 있어요.",
  },
  {
    status: "processing",
    stage: "generatingContent",
    progress: 64,
    message: "지원 직무에 맞는 이야기로 경험을 다듬고 있어요.",
  },
  {
    status: "processing",
    stage: "renderingPortfolio",
    progress: 88,
    message: "읽기 좋은 포트폴리오 화면으로 정리하고 있어요.",
  },
  {
    status: "completed",
    stage: "completed",
    progress: 100,
    message: "포트폴리오가 완성됐어요.",
  },
] satisfies GenerationScenarioStep[];
