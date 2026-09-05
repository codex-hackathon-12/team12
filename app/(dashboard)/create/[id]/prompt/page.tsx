"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  GENERATION_INPUT_LIMITS,
  type GitRepositoryDto,
  type PortfolioTone,
} from "@/contracts/api-contract";
import { ApiClientError, apiClient } from "@/lib/api-client";
import { LoadingState } from "@/components/ui/LoadingState";
import { MOCK_CHIP, MOCK_NOTE } from "@/lib/copy";
import { PROMPT_DIRECTIONS, composePrompt } from "@/lib/prompt-presets";

/** 상한은 계약 한 곳에서만 정한다. 여기 숫자를 적으면 서버와 갈라진다. */
const PROMPT_MAX = GENERATION_INPUT_LIMITS.prompt;
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
  /* 고른 방향과, 사용자가 그 문장을 직접 손댔는지.
     손댄 뒤에는 자동 조립을 멈춘다 — 애써 고쳐 쓴 글을 체크 한 번에 날려버리면
     안 된다. 대신 되돌릴 길만 남긴다. */
  const [directions, setDirections] = useState<string[]>([]);
  const [edited, setEdited] = useState(false);
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

  const toggleDirection = (id: string) => {
    const next = directions.includes(id)
      ? directions.filter((item) => item !== id)
      : [...directions, id];
    setDirections(next);
    setSubmitError(null);
    if (!edited) setPrompt(composePrompt(next));
  };

  /* 서버는 이 상한들로 이미 거절하고 있었는데 화면은 몰랐다. 11개째부터
     "생성 요청 값이 올바르지 않습니다"만 돌아와, 무엇이 문제인지 알 수 없었다. */
  const highlightList = highlights
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const highlightTooMany = highlightList.length > GENERATION_INPUT_LIMITS.highlights;
  const highlightTooLong = highlightList.filter(
    (item) => [...item].length > GENERATION_INPUT_LIMITS.highlightLength,
  );
  const roleOver = [...targetRole.trim()].length - GENERATION_INPUT_LIMITS.targetRole;

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
    if (roleOver > 0) {
      setSubmitError(`지원 직무가 ${roleOver.toLocaleString("ko-KR")}자 넘어요. 줄인 뒤 다시 눌러주세요.`);
      return;
    }
    if (highlightTooMany) {
      setSubmitError(`강조하고 싶은 경험은 ${GENERATION_INPUT_LIMITS.highlights}개까지 적을 수 있어요.`);
      return;
    }
    if (highlightTooLong.length > 0) {
      setSubmitError(`강조하고 싶은 경험은 항목당 ${GENERATION_INPUT_LIMITS.highlightLength}자 이내로 적어주세요.`);
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
        highlights: highlightList,
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
              {/* maxLength는 상한에 닿는 순간 아무 말 없이 입력을 삼킨다.
                  막지 않고 넘겼을 때 알린다. 서버도 이제 자르지 않고 거절한다. */}
              <input
                value={targetRole}
                onChange={(event) => {
                  setTargetRole(event.target.value);
                  setSubmitError(null);
                }}
                placeholder="예: Backend Engineer"
              />
              {roleOver > 0 ? (
                <small className="counter-over" role="status">
                  {roleOver.toLocaleString("ko-KR")}자 줄여주세요
                </small>
              ) : null}
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
            {/* "사용자 경험, 성능 개선"처럼 뭉뚱그린 말은 어느 저장소에도 걸리지
                않아 결과에 반영되지 않는다. 무엇을 적어야 걸리는지 예시가 보여준다. */}
            <input
              value={highlights}
              onChange={(event) => {
                setHighlights(event.target.value);
                setSubmitError(null);
              }}
              placeholder="예: 결제 재시도 설계, 목록 조회 N+1 제거, 배포 자동화"
            />
            <small>
              쉼표로 구분해 {GENERATION_INPUT_LIMITS.highlights}개까지,
              항목당 {GENERATION_INPUT_LIMITS.highlightLength}자 이내로 적어주세요.
              {highlightList.length > 0 ? ` (${highlightList.length}개)` : ""}
            </small>
          </label>

          {/*
            백지에 "무엇을 강조할지 적어주세요"라고 두면 대부분 아무것도 못
            적거나 "잘 써주세요"라고 적는다. 예문을 보여주는 것으로도 부족했다 —
            읽고 나서 여전히 자기 손으로 옮겨 적어야 하기 때문이다.
            고르면 아래 문장이 만들어지고, 그 문장은 그대로 고칠 수 있다.
          */}
          <fieldset className="prompt-directions">
            <legend>어떤 방향으로 쓸까요? <em>(여러 개 고를 수 있어요)</em></legend>
            <div>
              {PROMPT_DIRECTIONS.map((direction) => (
                <label className="prompt-direction" key={direction.id}>
                  <input
                    type="checkbox"
                    checked={directions.includes(direction.id)}
                    onChange={() => toggleDirection(direction.id)}
                  />
                  {/* 이름과 설명을 label 바로 아래에 둔다. span으로 한 번 더
                      감싸면 접근 가능한 이름이 한 단계 깊어져 보조 기술이
                      라벨 없는 체크박스로 읽는다. 배치는 CSS가 맡는다. */}
                  <strong>{direction.label}</strong>
                  <small>{direction.hint}</small>
                </label>
              ))}
            </div>
          </fieldset>

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
                /* 조립된 문장과 달라진 순간부터 사용자의 글이다. 그 뒤로는
                   체크를 바꿔도 덮어쓰지 않는다. */
                setEdited(event.target.value !== composePrompt(directions));
                setSubmitError(null);
              }}
              placeholder="위에서 방향을 고르거나, 여기에 직접 적어주세요."
              rows={8}
              /* required를 두면 브라우저 말풍선이 세 번째 오류 모양이 되고,
                 그 단계에서 막혀 아래 인라인 안내가 아예 나오지 않는다. */
            />
            {/* 고쳐 쓴 글을 체크 한 번에 날려버리지 않는 대신, 되돌릴 길은 남긴다. */}
            {edited && directions.length > 0 ? (
              <button
                className="text-link prompt-recompose"
                type="button"
                onClick={() => {
                  setPrompt(composePrompt(directions));
                  setEdited(false);
                }}
              >
                고른 방향대로 다시 만들기
              </button>
            ) : null}
            {/* 이 칸이 실제로 정하는 것은 강조 순서와 문체이지 사실이 아니다.
                "응답 속도를 40% 줄였다"라고 적어도 저장소에 근거가 없으면 결과에
                들어가지 않는다. 그걸 모르면 반영이 안 된 이유를 알 수 없고,
                사실을 말할 자리가 따로 있다는 것도 모른 채 지나간다. */}
            <p className="prompt-scope-note">
              여기 적은 내용은 <strong>무엇을 앞에 둘지와 어떤 문체로 쓸지</strong>를 정해요.
              성과나 수치는 저장소에서 확인되는 것만 들어가요. 저장소만 봐서는 알 수 없는
              것은 결과가 나온 뒤에 따로 물어볼게요.
            </p>
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
