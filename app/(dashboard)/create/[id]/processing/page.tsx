"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { GenerationJobDto } from "@/contracts/api-contract";
import { ApiClientError, apiClient } from "@/lib/api-client";
import { GenerationProgress } from "@/components/generation/GenerationProgress";
import { LoadingState } from "@/components/ui/LoadingState";

const POLL_INTERVAL_MS = 2000;
const MAX_CONSECUTIVE_POLL_FAILURES = 3;
/* 서버 쪽 멈춘 작업 정리 임계보다 넉넉하게 잡는다. 대개 그 전에 실패로 바뀐다. */
const POLL_GIVE_UP_MS = 15 * 60 * 1000;

export default function ProcessingPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const jobId = String(params.id);
  const [job, setJob] = useState<GenerationJobDto | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let consecutiveFailures = 0;
    const startedAt = Date.now();

    const poll = async () => {
      try {
        const nextJob = await apiClient.getGeneration(jobId);
        if (!active) return;
        consecutiveFailures = 0;
        setJob(nextJob);
        setPollError(null);
        if (nextJob.status === "completed" && nextJob.portfolioId) {
          timer = setTimeout(
            () => router.replace(`/portfolios/${nextJob.portfolioId}`),
            700,
          );
          return;
        }
        if (nextJob.status === "failed") return;
        // 서버가 멈춘 작업을 정리해줄 때까지도 이 화면이 계속 물어본다.
        if (Date.now() - startedAt > POLL_GIVE_UP_MS) {
          setPollError(
            "작업이 예상보다 오래 걸리고 있어요. 대시보드에서 나중에 다시 확인해주세요.",
          );
          return;
        }
        timer = setTimeout(poll, POLL_INTERVAL_MS);
      } catch {
        if (!active) return;
        /* 한 번의 네트워크 끊김으로 화면을 접으면 멀쩡한 작업도 실패처럼 보인다.
           연속으로 실패할 때만 포기하고, 그 사이에는 간격을 늘려 기다린다. */
        consecutiveFailures += 1;
        if (consecutiveFailures >= MAX_CONSECUTIVE_POLL_FAILURES) {
          setPollError("생성 상태를 확인하지 못했어요. 잠시 후 다시 시도해주세요.");
          return;
        }
        timer = setTimeout(poll, POLL_INTERVAL_MS * 2 ** consecutiveFailures);
      }
    };

    poll();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [jobId, router]);

  const retry = async () => {
    if (isRetrying) return;
    setIsRetrying(true);
    setRetryError(null);
    try {
      const result = await apiClient.retryGeneration(jobId);
      router.replace(`/create/${result.job.jobId}/processing`);
    } catch (error) {
      setRetryError(
        error instanceof ApiClientError && error.code === "GENERATION_IN_PROGRESS"
          ? "이미 진행 중인 생성이 있어요. 잠시 후 다시 눌러주세요."
          : "다시 시도하지 못했어요. 잠시 후 다시 눌러주세요.",
      );
      setIsRetrying(false);
    }
  };

  if (!job && !pollError) return <LoadingState label="생성 작업을 확인하고 있어요" />;

  if (pollError) {
    return (
      <section className="page-container page-state">
        <p className="eyebrow">CONNECTION PAUSED</p>
        <h1>{pollError}</h1>
        <div className="page-state-actions">
          <button className="button primary" type="button" onClick={() => window.location.reload()}>
            다시 확인하기
          </button>
          <Link className="button secondary" href="/dashboard">대시보드로 이동</Link>
        </div>
      </section>
    );
  }

  if (!job) return null;

  return (
    <div className="page-container processing-page">
      {job.status === "failed" ? (
        <section className="generation-failed">
          <p className="eyebrow">GENERATION STOPPED</p>
          <h1>결과를 완성하지 못했어요.</h1>
          <p>{job.error?.message ?? "잠시 후 다시 시도해주세요."}</p>
          <div className="page-state-actions">
            <button className="button primary" type="button" onClick={retry} disabled={isRetrying}>
              {isRetrying ? "다시 시도하는 중…" : "다시 시도하기"}
            </button>
            <Link className="button secondary" href="/repositories">다른 저장소 선택</Link>
          </div>
          {retryError ? <p className="inline-error" role="alert">{retryError}</p> : null}
        </section>
      ) : (
        <>
          <GenerationProgress job={job} />
        </>
      )}
    </div>
  );
}
