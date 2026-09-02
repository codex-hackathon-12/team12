import type { GenerationJobDto, GenerationStage } from "@/contracts/api-contract";

/**
 * 생성 진행을 사용자에게 설명하는 문구와 수치.
 *
 * 서버가 `message` 컬럼에 문장을 써두지만 그건 표시용으로 쓰지 않는다. 두 가지
 * 이유다. 하나, 컬럼은 쓰는 순간의 문장으로 박제되어 문구를 고쳐도 이미 쌓인
 * 작업은 옛 문장을 그대로 들고 있다. 둘, 그 문장이 진행 화면의 가장 큰 제목인데
 * 클라이언트에서 검증할 방법이 없었다. `(단계, 저장소 수)`로 다시 만들 수 있는
 * 값이므로 여기로 옮긴다. `lib/format.ts`가 같은 이유로 만들어졌다.
 */

export type GenerationStep = { stage: GenerationStage; label: string };

export const GENERATION_STEPS: GenerationStep[] = [
  { stage: "queued", label: "요청 확인" },
  { stage: "analyzingRepository", label: "저장소 분석" },
  { stage: "generatingContent", label: "스토리 구성" },
  { stage: "renderingPortfolio", label: "화면 완성" },
];

/**
 * 단계별로 대략 얼마나 걸리는지의 비율.
 *
 * 서버가 쓰는 15/40/55/80은 단계가 바뀌는 순간에만 갱신되는 상수라, 가장 오래
 * 걸리는 스토리 구성 구간에서 숫자가 통째로 얼어 있었다. 멈춘 것처럼 보이는
 * 진행률은 없는 것보다 나쁘다. 실제 소요에 가까운 가중치를 두고 경과 시간으로
 * 사이를 메운다.
 */
const STEP_WEIGHTS = [0.05, 0.3, 0.5, 0.15];
/** 단계별 예상 소요(초). 경과 시간을 진행률로 환산하는 기준이다. */
const STEP_SECONDS = [3, 25, 60, 12];

export function stageIndex(stage: GenerationStage): number {
  if (stage === "completed") return GENERATION_STEPS.length;
  const found = GENERATION_STEPS.findIndex((step) => step.stage === stage);
  // 실패한 작업은 어느 단계도 "진행 중"이 아니다.
  return found === -1 ? 0 : found;
}

export function stageMessage(job: Pick<GenerationJobDto, "stage" | "repositoryIds">): string {
  const count = job.repositoryIds.length;
  switch (job.stage) {
    case "queued":
      return "생성 요청을 받았어요.";
    case "analyzingRepository":
      return count > 1
        ? `GitHub 저장소 ${count}개를 읽고 있어요.`
        : "GitHub 저장소를 읽고 있어요.";
    case "generatingContent":
      return "읽은 내용을 포트폴리오 이야기로 정리하고 있어요.";
    case "renderingPortfolio":
      return "결과를 문서로 만들고 있어요.";
    case "completed":
      return "포트폴리오가 완성됐어요.";
    case "failed":
      return "만들다가 멈췄어요.";
  }
}

/**
 * 진행률을 실제 경과에 맞춰 계산한다.
 *
 * 지금 단계까지의 가중치를 더하고, 그 위에 현재 단계에서 흐른 시간만큼을 얹는다.
 * 다음 체크포인트는 넘지 않으므로 숫자가 앞질러 가거나 되돌아가지 않는다.
 */
export function progressPercent(
  job: Pick<GenerationJobDto, "stage" | "status" | "updatedAt">,
  now: number = Date.now(),
): number {
  if (job.stage === "completed") return 100;

  const index = stageIndex(job.stage);
  const before = STEP_WEIGHTS.slice(0, index).reduce((sum, weight) => sum + weight, 0);
  const current = STEP_WEIGHTS[index] ?? 0;

  const enteredAt = Date.parse(job.updatedAt);
  const seconds = Number.isFinite(enteredAt) ? Math.max(0, (now - enteredAt) / 1000) : 0;
  const expected = STEP_SECONDS[index] ?? 1;
  /* 예상보다 오래 걸려도 이 단계의 몫을 다 쓰지는 않는다. 아직 안 끝난 일을
     끝났다고 말하지 않기 위해서다. */
  const withinStep = Math.min(seconds / expected, 1) * current * 0.9;

  return Math.min(99, Math.round((before + withinStep) * 100));
}

/** 스크린리더가 읽을 진행 상태. 숫자만으로는 어디쯤인지 알 수 없다. */
export function stageValueText(job: Pick<GenerationJobDto, "stage" | "repositoryIds">): string {
  const index = stageIndex(job.stage);
  const step = GENERATION_STEPS[index];
  return step
    ? `${GENERATION_STEPS.length}단계 중 ${index + 1}단계 · ${step.label}`
    : "생성 완료";
}

/**
 * 얼마나 지났는지. 진행률이 잠시 멈춰 보여도 이 값은 항상 움직이므로,
 * 작업이 살아 있다는 사실을 전달한다.
 */
export function elapsedLabel(createdAt: string, now: number = Date.now()): string {
  const started = Date.parse(createdAt);
  if (!Number.isFinite(started)) return "";
  const seconds = Math.max(0, Math.floor((now - started) / 1000));
  if (seconds < 60) return `${seconds}초 지났어요`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${minutes}분 지났어요` : `${minutes}분 ${rest}초 지났어요`;
}
