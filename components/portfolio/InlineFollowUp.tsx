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
 * 비어 있는 자리에서 직접 되묻는다.
 *
 * 예전에는 문서 위에 textarea가 나열돼 있었다. 답이 문서의 어디로 가는지 보이지
 * 않아, 사용자는 무엇을 위해 쓰는지 모른 채 칸을 채워야 했다. 채울 자리에서
 * 물으면 답의 범위가 저절로 정해지고, 반영된 뒤에는 그 자리에 결정이 들어차는
 * 것을 눈으로 확인하게 된다.
 *
 * 화면 전용이다. 인쇄에서는 숨긴다 — 종이에 남으면 채용 담당자가 지원자에게
 * 던지는 질문 목록이 된다.
 */

/** 이만큼 남았을 때부터 남은 글자 수를 알린다. 막지 않고 알린다(GOV.UK). */
const COUNTER_THRESHOLD = 100;

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

/**
 * 같은 결정에 속한 질문을 한 카드로 묶는다.
 *
 * 셋은 하나의 결정이므로 한 동작으로 보낸다. 따로 보내면 반쪽짜리 결정이 되어
 * 서버가 반영하지 않고, 사용자에게는 "답했는데 아무것도 안 바뀐다"로 보인다.
 */
type Group = { topic: string | null; questions: PortfolioQuestionDto[] };

function groupByTopic(questions: PortfolioQuestionDto[]): Group[] {
  const decisions = new Map<string, PortfolioQuestionDto[]>();
  const singles: PortfolioQuestionDto[] = [];

  for (const question of questions) {
    if (!question.topic) {
      singles.push(question);
      continue;
    }
    decisions.set(question.topic, [...(decisions.get(question.topic) ?? []), question]);
  }

  const groups: Group[] = [...decisions.entries()].map(([topic, list]) => ({ topic, questions: list }));
  // 낱개는 한 카드에 모은다. 질문마다 카드를 만들면 문서가 카드로 뒤덮인다.
  if (singles.length > 0) groups.push({ topic: null, questions: singles });
  return groups;
}

export function InlineFollowUp({
  portfolioId,
  questions,
  onApplied,
}: {
  portfolioId: string;
  /** 이 프로젝트에 대해 아직 답하지 않은 질문. */
  questions: PortfolioQuestionDto[];
  onApplied: (result: PortfolioStatementResultDto) => void;
}) {
  const groups = groupByTopic(questions);
  return (
    <div className="follow-up-slot">
      {groups.map((group) => (
        <FollowUpCard
          key={group.topic ?? "single"}
          portfolioId={portfolioId}
          group={group}
          onApplied={onApplied}
        />
      ))}
    </div>
  );
}

function FollowUpCard({
  portfolioId,
  group,
  onApplied,
}: {
  portfolioId: string;
  group: Group;
  onApplied: (result: PortfolioStatementResultDto) => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDecision = Boolean(group.topic);
  const answered = group.questions.filter((question) => (drafts[question.id] ?? "").trim());
  const tooLong = group.questions.filter(
    (question) => [...(drafts[question.id] ?? "").trim()].length > PORTFOLIO_ANSWER_MAX_LENGTH,
  );

  const submit = async () => {
    if (submitting) return;
    /* 조용히 return하면 버튼이 고장 난 것으로 보인다. 누른 사람에게 이유가 남아야 한다. */
    if (tooLong.length > 0) {
      setError(`답변은 ${PORTFOLIO_ANSWER_MAX_LENGTH}자 이내로 줄여주세요.`);
      return;
    }
    /* 결정은 셋이 다 있어야 문서에 들어간다. 하나만 보내면 서버가 반영하지
       않으므로, 보내기 전에 여기서 말한다. */
    if (isDecision && answered.length < group.questions.length) {
      setError("세 가지를 다 알려주셔야 이 결정을 채울 수 있어요.");
      return;
    }
    if (answered.length === 0) {
      setError("답변을 한 개 이상 적어주세요.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      onApplied(await apiClient.applyPortfolioStatements(
        portfolioId,
        answered.map((question) => ({
          questionId: question.id,
          answer: (drafts[question.id] ?? "").trim(),
        })),
      ));
    } catch (caught) {
      /* 근거가 사라진 결과는 다시 시도해도 되지 않는다. 같은 문구로 뭉뚱그리면
         사용자가 될 때까지 누르게 된다. */
      setError(
        caught instanceof ApiClientError && caught.code === "EVIDENCE_UNAVAILABLE"
          ? "이 포트폴리오는 생성 근거가 남아 있지 않아 다시 쓸 수 없어요. 새로 만들면 답변을 반영할 수 있어요."
          : "답변을 반영하지 못했어요. 잠시 후 다시 시도해주세요.",
      );
    } finally {
      /* 성공하면 이 카드는 사라지지만, 서버가 아무것도 반영하지 못해 카드가
         남는 경우가 있다. 그때 진행 표시를 안 되돌리면 버튼이 영영
         "다시 쓰는 중…"에 머물러 사용자가 다시 시도할 수 없다. */
      setSubmitting(false);
    }
  };

  return (
    <section className="follow-up-card" aria-label={isDecision ? "핵심 결정 채우기" : "더 알려주기"}>
      <header>
        <p className="follow-up-eyebrow">{isDecision ? "핵심 결정 — 아직 비어 있어요" : "조금만 더"}</p>
        <p className="follow-up-lead">
          {isDecision
            ? "저장소만 봐서는 왜 그렇게 했는지 알 수 없어요."
            : "저장소에 드러나지 않은 것이 남아 있어요."}
        </p>
        {/* 무엇에 대한 질문인지 짚어야 답의 범위가 정해진다. 저장소에서 본
            그대로라 지원자가 "아, 그거" 하고 떠올릴 수 있다. */}
        {group.topic ? <p className="follow-up-topic">{group.topic}</p> : null}
      </header>

      {group.questions.map((question) => {
        const value = drafts[question.id] ?? "";
        const remaining = PORTFOLIO_ANSWER_MAX_LENGTH - [...value].length;
        return (
          <div className="follow-up-field" key={question.id}>
            <div>
              <label htmlFor={`follow-up-${question.id}`}>
                {!isDecision && (
                  <em className="follow-up-field-label">{FIELD_LABEL[question.field]}</em>
                )}
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
              rows={2}
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

      <div className="follow-up-actions">
        <button className="button primary" type="button" aria-disabled={submitting} onClick={submit}>
          <SteadyLabel
            states={["이 자리 채우기", "다시 쓰는 중…"]}
            value={submitting ? "다시 쓰는 중…" : "이 자리 채우기"}
          />
        </button>
        <p>
          {isDecision
            ? "답한 내용으로 이 자리만 다시 써요. 다른 문장은 그대로예요."
            : "답한 항목만 바뀌어요. 모두 답하지 않아도 괜찮아요."}
        </p>
      </div>

      {error ? <p className="inline-error" role="alert">{error}</p> : null}
    </section>
  );
}
