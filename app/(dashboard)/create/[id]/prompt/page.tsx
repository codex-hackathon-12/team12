"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import type { GitRepositoryDto, PortfolioTone } from "@/contracts/api-contract";
import { apiClient } from "@/lib/api-client";
import { LoadingState } from "@/components/ui/LoadingState";

export default function PromptPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const repositoryId = String(params.id);
  const [repository, setRepository] = useState<GitRepositoryDto | null>(null);
  const [targetRole, setTargetRole] = useState("Frontend Engineer");
  const [tone, setTone] = useState<PortfolioTone>("professional");
  const [highlights, setHighlights] = useState("사용자 경험, 협업 방식");
  const [prompt, setPrompt] = useState(
    "프론트엔드 직무에 맞춰 문제를 정의하고 해결한 과정, 사용자 경험을 개선한 선택을 강조해줘.",
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiClient.getRepository(repositoryId).then(setRepository);
  }, [repositoryId]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!prompt.trim()) return;
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

  if (!repository) return <LoadingState label="선택한 저장소를 확인하고 있어요" />;

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
          <span className="mono-label">SELECTED REPOSITORY</span>
          <div className="repo-icon">{repository.name.slice(0, 2).toUpperCase()}</div>
          <h2>{repository.name}</h2>
          <p>{repository.description}</p>
          <dl>
            <div><dt>Language</dt><dd>{repository.primaryLanguage}</dd></div>
            <div><dt>Branch</dt><dd>{repository.defaultBranch}</dd></div>
            <div><dt>Visibility</dt><dd>{repository.visibility}</dd></div>
          </dl>
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
                <strong>예상 비용 30 크레딧</strong>
                <p>MVP에서는 실제로 차감되지 않아요.</p>
              </div>
            </div>
            <span>100 → 100</span>
          </div>

          <button className="button primary submit-button" type="submit" disabled={submitting}>
            {submitting ? "생성 준비 중…" : "이 내용으로 포트폴리오 만들기"}
            {!submitting && <span aria-hidden="true">→</span>}
          </button>
        </form>
      </div>
    </div>
  );
}
