"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { GenerationJobDto } from "@/contracts/api-contract";
import { apiClient } from "@/lib/api-client";
import { GenerationProgress } from "@/components/generation/GenerationProgress";
import { LoadingState } from "@/components/ui/LoadingState";

export default function ProcessingPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const jobId = String(params.id);
  const [job, setJob] = useState<GenerationJobDto | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      try {
        const nextJob = await apiClient.getGeneration(jobId);
        if (!active) return;
        setJob(nextJob);
        setPollError(null);
        if (nextJob.status === "completed" && nextJob.portfolioId) {
          timer = setTimeout(
            () => router.replace(`/portfolios/${nextJob.portfolioId}`),
            700,
          );
          return;
        }
        if (nextJob.status !== "failed") timer = setTimeout(poll, 2000);
      } catch {
        if (!active) return;
        setPollError("생성 상태를 확인하지 못했어요. 잠시 후 다시 시도해주세요.");
      }
    };

    poll();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [jobId, router]);

  const retry = async () => {
    const result = await apiClient.retryGeneration(jobId);
    router.replace(`/create/${result.job.jobId}/processing`);
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
            <button className="button primary" type="button" onClick={retry}>다시 시도하기</button>
            <Link className="button secondary" href="/repositories">다른 저장소 선택</Link>
          </div>
        </section>
      ) : (
        <>
          <GenerationProgress job={job} />
          <div className="processing-footnote">
            <p>페이지를 닫아도 작업은 계속돼요. 같은 주소로 돌아오면 진행 상태를 이어서 확인할 수 있습니다.</p>
            <Link className="text-link" href="/dashboard">대시보드로 이동</Link>
          </div>
        </>
      )}
    </div>
  );
}
