"use client";

import { useState } from "react";
import {
  PORTFOLIO_ANSWER_MAX_LENGTH,
  type PortfolioQuestionDto,
  type PortfolioStatementResultDto,
} from "@/contracts/api-contract";
import { ApiClientError, apiClient } from "@/lib/api-client";
import { SteadyLabel } from "@/components/ui/SteadyLabel";

/**
 * 초안이 비워둔 자리를 지원자에게 되묻는 자리.
 *
 * 저장소에는 코드와 기록만 있고 "왜 그렇게 했는지"와 "그래서 무엇이 달라졌는지"는
 * 없다. 그건 만든 사람만 안다. 빈칸을 그럴듯하게 메우면 면접의 후속 질문 하나에
 * 무너지므로, 채우는 대신 묻는다.
 *
 * 문서 위에 둔다. 아래에 두면 답할 것이 있다는 사실 자체를 못 보고 나간다.
 * 다만 문서가 이 화면의 본체이므로 카드 하나에 담아 밀어내는 높이를 줄인다.
 */

const FIELD_LABEL: Record<PortfolioQuestionDto["field"], string> = {
  impact: "성과",
  challenges: "문제",
  solutions: "해결",
  role: "역할",
  highlights: "강조",
  decisionProblem: "문제",
  decisionApproach: "선택",
  decisionOutcome: "결과",
};

/** 이만큼 남았을 때부터 남은 글자 수를 알린다. 막지 않고 알린다(GOV.UK). */
const COUNTER_THRESHOLD = 100;

type Props = {
  portfolioId: string;
  questions: PortfolioQuestionDto[];
  /** 반영이 끝나면 바뀐 내용과 질문 상태를 화면 전체에 넘긴다. */
  onApplied: (result: PortfolioStatementResultDto) => void;
};

export function FollowUpPanel({ portfolioId, questions, onApplied }: Props) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<number | null>(null);

  const open = questions.filter((question) => !question.answer);
  const answered = questions.filter((question) => question.answer);

  // 물을 것이 없으면 아무것도 그리지 않는다. 답까지 마친 뒤에도 마찬가지다.
  if (open.length === 0 && applied === null) {
    return null;
  }

  const filled = open.filter((question) => (drafts[question.id] ?? "").trim().length > 0);
  const tooLong = filled.filter(
    (question) => [...(drafts[question.id] ?? "").trim()].length > PORTFOLIO_ANSWER_MAX_LENGTH,
  );

  const submit = async () => {
    if (submitting) return;
    /* 조용히 return하면 버튼이 고장 난 것으로 보인다. 누른 사람에게 이유가 남아야 한다. */
    if (tooLong.length > 0) {
      setError(`답변은 ${PORTFOLIO_ANSWER_MAX_LENGTH}자 이내로 줄여주세요.`);
      return;
    }
    if (filled.length === 0) {
      setError("답변을 한 개 이상 적어주세요.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const result = await apiClient.applyPortfolioStatements(
        portfolioId,
        filled.map((question) => ({
          questionId: question.id,
          answer: (drafts[question.id] ?? "").trim(),
        })),
      );
      setDrafts({});
      setApplied(result.updatedFields.length);
      onApplied(result);
    } catch (caught) {
      /* 근거가 사라진 결과는 다시 시도해도 되지 않는다. 같은 문구로 뭉뚱그리면
         사용자가 될 때까지 누르게 된다. */
      setError(
        caught instanceof ApiClientError && caught.code === "EVIDENCE_UNAVAILABLE"
          ? "이 포트폴리오는 생성 근거가 남아 있지 않아 다시 쓸 수 없어요. 새로 만들면 답변을 반영할 수 있어요."
          : "답변을 반영하지 못했어요. 잠시 후 다시 시도해주세요.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="page-container follow-up" aria-labelledby="follow-up-heading">
      <div className="follow-up-card">
        <header className="follow-up-heading">
          <span className="mono-label">MISSING CONTEXT</span>
          <h2 id="follow-up-heading">
            {open.length > 0
              ? "저장소만 봐서는 알 수 없는 것들이에요"
              : "답변을 반영했어요"}
          </h2>
          <p>
            {open.length > 0
              ? "코드는 무엇을 했는지 말해주지만 왜 그렇게 했는지, 그래서 무엇이 달라졌는지는 말해주지 않아요. 지어내는 대신 비워뒀어요. 답해주시면 그 자리만 다시 써요."
              : "다른 문장은 그대로예요."}
          </p>
        </header>

        {/* 답한 자리는 접어 둔다. 사라지면 무엇을 답했는지 확인할 수 없고,
            펼쳐두면 남은 질문이 묻힌다. */}
        {answered.length > 0 ? (
          <details className="follow-up-answered">
            <summary>답한 질문 {answered.length}개</summary>
            <dl>
              {answered.map((question) => (
                <div key={question.id}>
                  <dt>{question.question}</dt>
                  <dd>{question.answer}</dd>
                </div>
              ))}
            </dl>
          </details>
        ) : null}

        {open.map((question) => {
          const value = drafts[question.id] ?? "";
          const remaining = PORTFOLIO_ANSWER_MAX_LENGTH - [...value].length;
          return (
            <div className="follow-up-question" key={question.id}>
              <div>
                <label htmlFor={`follow-up-${question.id}`}>
                  {question.repositoryName ? (
                    <em className="follow-up-target">
                      {question.repositoryName} · {FIELD_LABEL[question.field]}
                    </em>
                  ) : null}
                  {question.question}
                </label>
                {remaining <= COUNTER_THRESHOLD ? (
                  <small className={remaining < 0 ? "counter-over" : "counter-near"} role="status">
                    {remaining < 0
                      ? `${(-remaining).toLocaleString("ko-KR")}자 줄여주세요`
                      : `${remaining.toLocaleString("ko-KR")}자 쓸 수 있어요`}
                  </small>
                ) : null}
              </div>
              <textarea
                id={`follow-up-${question.id}`}
                value={value}
                rows={3}
                placeholder="있었던 일을 그대로 적어주세요. 수치가 없어도 괜찮아요."
                onChange={(event) => {
                  setDrafts((previous) => ({ ...previous, [question.id]: event.target.value }));
                  // 고친 뒤에도 옛 오류가 남아 있으면 문구가 거짓말이 된다.
                  setError(null);
                }}
              />
            </div>
          );
        })}

        {open.length > 0 ? (
          <div className="follow-up-actions">
            <button
              className="button primary"
              type="button"
              aria-disabled={submitting}
              onClick={submit}
            >
              <SteadyLabel
                states={["답변 반영하기", "다시 쓰는 중…"]}
                value={submitting ? "다시 쓰는 중…" : "답변 반영하기"}
              />
            </button>
            <p>답한 항목만 바뀌고 나머지 문장은 그대로예요. 모두 답하지 않아도 괜찮아요.</p>
          </div>
        ) : null}

        {error ? <p className="inline-error" role="alert">{error}</p> : null}
        {applied !== null && !error ? (
          <p className="follow-up-result" role="status">
            {applied > 0
              ? `${applied}개 항목을 다시 썼어요. 아래 문서에서 확인해보세요.`
              : "답변에서 새로 쓸 내용을 찾지 못했어요. 조금 더 구체적으로 적어주시면 반영할 수 있어요."}
          </p>
        ) : null}
      </div>
    </section>
  );
}
