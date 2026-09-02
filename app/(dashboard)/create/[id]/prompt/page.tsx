"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { GitRepositoryDto, PortfolioTone } from "@/contracts/api-contract";
import { ApiClientError, apiClient } from "@/lib/api-client";
import { LoadingState } from "@/components/ui/LoadingState";
import { MOCK_CHIP, MOCK_NOTE } from "@/lib/copy";

/** 프롬프트 상한. 서버 계약과 같은 값이어야 한다. */
const PROMPT_MAX = 2000;
/** 이만큼 남았을 때부터 남은 글자 수를 알린다. */
const COUNTER_THRESHOLD = 200;

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
  /* 세 칸이 모두 채워진 채로 열렸다. 프론트엔드 지원자가 아니어도 "Frontend
     Engineer"가, 아무 말도 하지 않은 사람의 프롬프트에 프론트엔드 문장이 들어
     있었다. 그대로 제출하면 남이 쓴 답으로 만든 포트폴리오가 나온다.
     비워두고, 무엇을 쓰면 되는지는 예시로 보여준다. */
  const [targetRole, setTargetRole] = useState("");
  const [tone, setTone] = useState<PortfolioTone>("professional");
  const [highlights, setHighlights] = useState("");
  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all(repositoryIds.map((id) => apiClient.getRepository(id)))
      .then((result) => {
        if (!active) return;
        setRepositories(result);
        setLoadError(null);
      })
      .catch(() => {
        if (active) setLoadError("선택한 저장소를 불러오지 못했어요.");
      });
    return () => {
      active = false;
    };
  }, [repositoryIds]);

  const remaining = PROMPT_MAX - prompt.length;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    /* 조용히 return하면 버튼이 고장 난 것으로 보인다. aria-disabled는 상태를
       알릴 뿐 이유를 말하지 않으므로, 누른 사람에게는 이유가 남아야 한다. */
    if (remaining < 0) {
      setSubmitError(`프롬프트가 ${(-remaining).toLocaleString("ko-KR")}자 넘어요. 줄인 뒤 다시 눌러주세요.`);
      return;
    }
    if (!prompt.trim()) {
      setSubmitError("AI에게 전달할 프롬프트를 적어주세요.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const job = await apiClient.createGeneration({
        repositoryIds,
        prompt: prompt.trim(),
        // 비워둔 칸은 보내지 않는다. 빈 문자열을 답으로 넘기면 서버가 그것을 답으로 다룬다.
        targetRole: targetRole.trim() || undefined,
        tone,
        highlights: highlights
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      });
      router.push(`/create/${job.jobId}/processing`);
    } catch (error) {
      /* 이미 진행 중인 작업이 있을 때가 흔하다. 원인을 알려주지 않으면
         사용자는 버튼이 고장 난 줄 안다. */
      setSubmitError(
        error instanceof ApiClientError && error.code === "GENERATION_IN_PROGRESS"
          ? "이미 진행 중인 생성이 있어요. 그 작업이 끝난 뒤에 다시 시도해주세요."
          : "생성을 시작하지 못했어요. 잠시 후 다시 시도해주세요.",
      );
      setSubmitting(false);
    }
  };

  if (loadError) {
    return (
      <section className="page-container page-state">
        <p className="eyebrow">LOAD FAILED</p>
        <h1>{loadError}</h1>
        <div className="page-state-actions">
          <Link className="button primary" href="/repositories">저장소 다시 고르기</Link>
        </div>
      </section>
    );
  }

  if (!repositories) return <LoadingState label="선택한 저장소를 불러오고 있어요" />;

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
          <p>선택한 프로젝트의 공통 강점과 서로 다른 역할을 한 흐름으로 정리해드려요.</p>
          <Link className="text-link" href="/repositories">← 저장소 다시 고르기</Link>
        </aside>

        <form className="prompt-form" onSubmit={submit}>
          <div className="form-row two-columns">
            <label>
              {/* 필수는 하나뿐이라 선택 쪽을 표기한다(GOV.UK). NN/g는 반대로
                  필수를 표기하라고 해 출처가 갈리므로, 제품 전체에 한 쪽만 쓴다. */}
              <span>지원 직무 <em>(선택)</em></span>
              <input
                value={targetRole}
                onChange={(event) => setTargetRole(event.target.value)}
                placeholder="예: Frontend Engineer"
                maxLength={100}
              />
            </label>
            <label>
              <span>문체 <em>(선택)</em></span>
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
            <span>강조하고 싶은 경험 <em>(선택)</em></span>
            <input
              value={highlights}
              onChange={(event) => setHighlights(event.target.value)}
              placeholder="예: 사용자 경험, 성능 개선, 팀 협업"
            />
            <small>쉼표로 구분해 적어주세요.</small>
          </label>

          <div className="prompt-textarea-label">
            <div>
              <label htmlFor="portfolio-prompt">AI에게 전달할 프롬프트</label>
              {/* maxLength는 상한에 닿는 순간 아무 말 없이 입력을 삼킨다. 붙여넣기로
                  넘긴 사람은 뒷부분이 사라진 것을 모른 채 제출한다. 막지 않고
                  가까워졌을 때부터 알린다(GOV.UK 글자 수 세기). */}
              {remaining <= COUNTER_THRESHOLD ? (
                <small className={remaining < 0 ? "counter-over" : "counter-near"} role="status">
                  {remaining < 0
                    ? `${(-remaining).toLocaleString("ko-KR")}자 줄여주세요`
                    : `${remaining.toLocaleString("ko-KR")}자 쓸 수 있어요`}
                </small>
              ) : (
                <small>{prompt.length.toLocaleString("ko-KR")} / {PROMPT_MAX.toLocaleString("ko-KR")}</small>
              )}
            </div>
            <textarea
              id="portfolio-prompt"
              value={prompt}
              /* 고친 뒤에도 옛 오류가 남아 있으면 문구가 거짓말이 된다. */
              onChange={(event) => {
                setPrompt(event.target.value);
                setSubmitError(null);
              }}
              placeholder="예: 문제를 정의하고 해결한 과정, 그 선택을 한 이유가 드러나게 써줘."
              rows={8}
              /* required를 두면 브라우저 말풍선이 세 번째 오류 모양이 되고,
                 그 단계에서 막혀 아래 인라인 안내가 아예 나오지 않는다. */
            />
          </div>

          <div className="credit-quote">
            <div>
              <span className="signal-dot" />
              <div>
                <strong>예상 비용 {estimatedCost} 크레딧</strong>
                <p>{MOCK_NOTE}</p>
              </div>
            </div>
            {/* 잔액이 줄지 않는데 화살표로 이어 보이면 차감된다는 뜻이 된다. */}
            <span className="mock-chip">{MOCK_CHIP}</span>
          </div>

          {/* 잠긴 이유를 말하지 않고 잠그면 버튼이 고장 난 것으로 보인다. */}
          <button
            className="button primary submit-button"
            type="submit"
            aria-disabled={submitting || remaining < 0}
          >
            {submitting ? "생성 준비 중…" : "이 내용으로 포트폴리오 만들기"}
            {!submitting && <span aria-hidden="true">→</span>}
          </button>
          {submitError ? <p className="inline-error" role="alert">{submitError}</p> : null}
        </form>
      </div>
    </div>
  );
}
