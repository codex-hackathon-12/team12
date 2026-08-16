import type { GenerationJobDto, GenerationStage } from "@/contracts/api-contract";

const steps: Array<{ stage: GenerationStage; label: string }> = [
  { stage: "queued", label: "요청 확인" },
  { stage: "analyzingRepository", label: "저장소 분석" },
  { stage: "generatingContent", label: "스토리 구성" },
  { stage: "renderingPortfolio", label: "화면 완성" },
];

export function GenerationProgress({ job }: { job: GenerationJobDto }) {
  const currentIndex =
    job.stage === "completed"
      ? steps.length
      : Math.max(
          0,
          steps.findIndex((item) => item.stage === job.stage),
        );

  return (
    <div className="generation-progress">
      <div className="progress-orbit" aria-hidden="true">
        <div className="orbit-ring ring-one" />
        <div className="orbit-ring ring-two" />
        <div className="orbit-core">{job.progress}</div>
      </div>

      <div className="progress-copy">
        <p className="eyebrow">AI PORTFOLIO ENGINE</p>
        <h1>{job.message}</h1>
        <p>
          코드를 읽고, 선택의 이유를 찾고, 채용 담당자가 이해하기 쉬운
          이야기로 정리합니다.
        </p>
      </div>

      <ol className="generation-steps">
        {steps.map((step, index) => (
          <li
            key={step.stage}
            className={
              index < currentIndex
                ? "complete"
                : index === currentIndex
                  ? "current"
                  : ""
            }
          >
            <span className="step-indicator" aria-hidden="true">
              {index < currentIndex ? "✓" : String(index + 1).padStart(2, "0")}
            </span>
            <span>{step.label}</span>
          </li>
        ))}
      </ol>

      <div className="progress-bar" aria-label={`생성 진행률 ${job.progress}%`}>
        <span style={{ width: `${job.progress}%` }} />
      </div>
    </div>
  );
}
