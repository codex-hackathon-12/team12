"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { GitRepositoryDto, PortfolioTone } from "@/contracts/api-contract";
import { apiClient, apiMode } from "@/lib/api-client";
import { LoadingState } from "@/components/ui/LoadingState";

export default function PromptPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const repositoryId = String(params.id);
  const repositoryQuery = searchParams.get("repositories");
  const repositoryIds = useMemo(
    () =>
      Array.from(
        new Set(
          (repositoryQuery ? repositoryQuery.split(",") : [repositoryId])
            .map((id) => id.trim())
            .filter(Boolean),
        ),
      ),
    [repositoryId, repositoryQuery],
  );
  const [repositories, setRepositories] = useState<GitRepositoryDto[] | null>(null);
  const [targetRole, setTargetRole] = useState("Frontend Engineer");
  const [tone, setTone] = useState<PortfolioTone>("professional");
  const [highlights, setHighlights] = useState("사용자 경험, 협업 방식");
  const [prompt, setPrompt] = useState(
    "프론트엔드 직무에 맞춰 문제를 정의하고 해결한 과정, 사용자 경험을 개선한 선택을 강조해줘.",
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all(repositoryIds.map((id) => apiClient.getRepository(id))).then(
      setRepositories,
    );
  }, [repositoryIds]);

  const multipleHttpUnavailable = apiMode === "http" && repositoryIds.length > 1;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!prompt.trim() || multipleHttpUnavailable) return;
    setSubmitting(true);
    const job = await apiClient.createGeneration({
      repositoryId,
      prompt: prompt.trim(),
      targetRole,
      tone,
      highlights: highlights
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    });
    router.push(`/create/${job.jobId}/processing`);
  };

  if (!repositories) return <LoadingState label="선택한 저장소를 확인하고 있어요" />;

  const estimatedCost = repositories.length * 30;

  return (
    <div className="page-container prompt-page">
      <div className="flow-breadcrumb" aria-label="생성 단계">
        <span className="done">01 저장소 선택</span>
        <span aria-hidden="true">/</span>
        <span className="active">02 프롬프트 입력</span>
        <span aria-hidden="true">/</span>
        <span>03 결과 생성</span>
      </div>

      <header className="page-heading prompt-heading">
        <div>
          <p className="eyebrow">STEP 02 · SHAPE YOUR STORY</p>
          <h1>코드에 담긴 맥락을<br />조금만 더 들려주세요.</h1>
        </div>
        <p>
          누구에게 보여줄 포트폴리오인지 알려주면, 같은 코드에서도 더
          정확한 강점을 찾아낼 수 있어요.
        </p>
      </header>

      <div className="prompt-layout">
        <aside className="selected-repository">
          <div className="selected-repository-heading">
            <span className="mono-label">SELECTED REPOSITORIES</span>
            <strong>{repositories.length}</strong>
          </div>
          <div className="selected-repository-list">
            {repositories.map((repository, index) => (
              <div className="selected-repository-item" key={repository.id}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{repository.name}</strong>
                  <small>{repository.primaryLanguage ?? "Language unknown"}</small>
                </div>
              </div>
            ))}
          </div>
          <p>선택한 프로젝트의 공통 강점과 서로 다른 역할을 한 흐름으로 정리합니다.</p>
          <Link className="text-link" href="/repositories">← 저장소 다시 선택</Link>
        </aside>

        <form className="prompt-form" onSubmit={submit}>
          <div className="form-row two-columns">
            <label>
              <span>지원 직무</span>
              <input
                value={targetRole}
                onChange={(event) => setTargetRole(event.target.value)}
                maxLength={100}
              />
            </label>
            <label>
              <span>문체</span>
              <select
                value={tone}
                onChange={(event) => setTone(event.target.value as PortfolioTone)}
              >
                <option value="professional">전문적이고 명료하게</option>
                <option value="concise">짧고 간결하게</option>
                <option value="storytelling">이야기 중심으로</option>
              </select>
            </label>
          </div>

          <label>
            <span>강조하고 싶은 경험</span>
            <input
              value={highlights}
              onChange={(event) => setHighlights(event.target.value)}
              placeholder="쉼표로 구분해 입력하세요"
            />
            <small>예: 사용자 경험, 성능 개선, 팀 협업</small>
          </label>

          <div className="prompt-textarea-label">
            <div>
              <label htmlFor="portfolio-prompt">AI에게 전달할 프롬프트</label>
              <small>{prompt.length} / 2,000</small>
            </div>
            <textarea
              id="portfolio-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              maxLength={2000}
              rows={8}
              required
            />
          </div>

          <div className="credit-quote">
            <div>
              <span className="signal-dot" />
              <div>
                <strong>예상 비용 {estimatedCost} 크레딧</strong>
                <p>MVP에서는 실제로 차감되지 않아요.</p>
              </div>
            </div>
            <span>100 → 100</span>
          </div>

          {multipleHttpUnavailable && (
            <p className="integration-note" role="status">
              여러 저장소를 합치는 실제 분석 API는 연결 중입니다. 현재 다중 선택은
              mock 미리보기에서 확인할 수 있어요.
            </p>
          )}

          <button
            className="button primary submit-button"
            type="submit"
            disabled={submitting || multipleHttpUnavailable}
          >
            {submitting ? "생성 준비 중…" : "이 내용으로 포트폴리오 만들기"}
            {!submitting && <span aria-hidden="true">→</span>}
          </button>
        </form>
      </div>
    </div>
  );
}
