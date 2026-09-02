"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { GenerationJobDto } from "@/contracts/api-contract";
import {
  GENERATION_STEPS,
  LABEL,
  elapsedLabel,
  progressPercent,
  stageIndex,
  stageMessage,
  stageValueText,
} from "@/lib/copy";

/** 보통 이 정도 걸린다는 사실을 미리 말해두면 기다림이 훨씬 견딜 만해진다. */
const EXPECTED_RANGE = "보통 1~3분 걸려요";

export function GenerationProgress({ job }: { job: GenerationJobDto }) {
  const currentIndex = stageIndex(job.stage);

  /* 진행률과 경과 시간은 시간이 흐르는 것만으로 바뀐다. 서버 응답을 기다리지
     않고 1초마다 다시 그려야 화면이 살아 있는 것으로 보인다. */
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const percent = progressPercent(job, now);
  const valueText = stageValueText(job);

  return (
    <div className="generation-progress">
      <div className="progress-orbit" aria-hidden="true">
        <div className="orbit-ring ring-one" />
        <div className="orbit-ring ring-two" />
        <div className="orbit-core">{percent}</div>
      </div>

      <div className="progress-copy">
        <p className="eyebrow">AI PORTFOLIO ENGINE</p>
        {/* 2초마다 조용히 바뀌던 제목. 바뀌었다는 사실을 알려준다. */}
        <h1 aria-live="polite" aria-atomic="true">{stageMessage(job)}</h1>
        <p>코드를 읽고, 선택의 이유를 찾고, 채용 담당자가 이해하기 쉬운 이야기로 정리해요.</p>
        <p className="progress-timing">
          <span>{elapsedLabel(job.createdAt, now)}</span>
          <span aria-hidden="true"> · </span>
          <span>{EXPECTED_RANGE}</span>
        </p>
      </div>

      <ol className="generation-steps">
        {GENERATION_STEPS.map((step, index) => {
          const done = index < currentIndex;
          const current = index === currentIndex;
          return (
            <li key={step.stage} className={done ? "complete" : current ? "current" : ""}>
              <span className="step-indicator" aria-hidden="true">
                {done ? "✓" : String(index + 1).padStart(2, "0")}
              </span>
              <span>{step.label}</span>
              {/* 완료와 진행 중을 색으로만 구분하면 색을 못 보는 사람에게는 같은 줄이다. */}
              {done ? <span className="sr-only">완료</span> : null}
              {current ? <span className="sr-only">진행 중</span> : null}
            </li>
          );
        })}
      </ol>

      {/*
        예전에는 role 없는 div에 aria-label을 달아 화면 낭독기가 통째로 무시했다.
        아직 시작 전이면 valuenow를 비워 "얼마나 남았는지 모름" 상태로 둔다.
      */}
      <div
        className="progress-bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={job.stage === "queued" ? undefined : percent}
        aria-valuetext={valueText}
      >
        <span style={{ width: `${percent}%` }} />
      </div>

      {/* 10초 넘게 걸리는 일에는 빠져나갈 길이 분명해야 한다. 각주가 아니라 여기에 둔다. */}
      <div className="progress-exit">
        <p>이 화면을 닫아도 계속 만들어져요.</p>
        <Link className="button secondary" href="/dashboard">
          {LABEL.dashboard}에서 보기
        </Link>
      </div>
    </div>
  );
}
