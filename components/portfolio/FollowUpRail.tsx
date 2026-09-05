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
 * 문서 옆에서 되묻는다.
 *
 * 처음에는 비어 있는 자리에 카드를 직접 끼워 넣었다. 답이 어디로 가는지는
 * 분명했지만 대가가 컸다 — 읽는 대상 한가운데 편집 UI가 박혔고, A4 보기에서는
 * 나눔이 어긋나는 것을 피하려고 아예 숨겨야 했다. 숨긴 자리를 "읽기 보기에서
 * 채울 수 있어요" 한 줄로 덮었는데, 그건 막다른 길을 가린 것이지 고친 것이
 * 아니었다.
 *
 * 문서 밖으로 나오면 둘 다 풀린다. 문서는 다시 문서만 남고, 화면 전용 요소가
 * 문서 높이에 끼어들지 않으므로 A4 보기에서도 그대로 쓸 수 있다. 어느
 * 프로젝트 이야기인지는 문서에 남긴 표시와 눌러서 이동으로 잇는다.
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

export type RailProject = {
  /** 문서에서 이 프로젝트를 찾는 열쇠. */
  url: string;
  name: string;
  title: string;
  questions: PortfolioQuestionDto[];
};

/**
 * 문서에서 그 프로젝트의 블록을 찾는다.
 *
 * A4 보기에서는 같은 속성이 DOM에 두 번 있다. 하나는 높이를 재려고 화면 밖에
 * 그려둔 사본이라, 그쪽을 잡으면 스크롤도 강조도 보이지 않는 곳에서 일어난다.
 */
function findProjectBlock(url: string): HTMLElement | null {
  const candidates = document.querySelectorAll<HTMLElement>(`[data-project-url="${CSS.escape(url)}"]`);
  return [...candidates].find((element) => !element.closest(".portfolio-pages-measure")) ?? null;
}

/** 같은 결정에 속한 질문을 한 카드로 묶는다. 셋은 하나의 결정이라 한 번에 보낸다. */
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
  if (singles.length > 0) groups.push({ topic: null, questions: singles });
  return groups;
}

export function FollowUpRail({
  portfolioId,
  projects,
  open,
  onClose,
  onApplied,
}: {
  portfolioId: string;
  /** 답할 것이 남은 프로젝트를 문서에 나오는 순서로. */
  projects: RailProject[];
  open: boolean;
  onClose: () => void;
  onApplied: (result: PortfolioStatementResultDto) => void;
}) {
  if (!open || projects.length === 0) return null;

  const total = projects.reduce((count, project) => count + project.questions.length, 0);

  return (
    <aside className="follow-up-rail" aria-label="더 알려주기">
      <header className="follow-up-rail-head">
        <div>
          <p className="mono-label">MISSING CONTEXT</p>
          <strong>답할 것 {total}개</strong>
        </div>
        <button className="text-link" type="button" onClick={onClose}>닫기</button>
      </header>

      {/* 머리는 고정하고 목록만 스크롤한다. 개수와 닫기가 늘 같은 자리에 있어야
          몇 개 남았는지 보면서 답할 수 있다. */}
      <div className="follow-up-rail-body">
        <p className="follow-up-rail-lead">
          저장소만 봐서는 알 수 없는 것들이에요. 답해주시면 문서의 그 자리만 다시 써요.
        </p>

        {projects.map((project) => (
          <section className="follow-up-project" key={project.url}>
          {/* 어느 프로젝트 이야기인지 잇는 자리. 누르면 문서에서 그곳으로 간다. */}
            <button
              className="follow-up-project-name"
              type="button"
              onClick={() => {
                const block = findProjectBlock(project.url);
                block?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
              onMouseEnter={() => findProjectBlock(project.url)?.classList.add("result-block-active")}
              onMouseLeave={() => findProjectBlock(project.url)?.classList.remove("result-block-active")}
              onFocus={() => findProjectBlock(project.url)?.classList.add("result-block-active")}
              onBlur={() => findProjectBlock(project.url)?.classList.remove("result-block-active")}
            >
              {project.title}
              <span aria-hidden="true">문서에서 보기 ↓</span>
            </button>

            {groupByTopic(project.questions).map((group) => (
              <FollowUpCard
                key={group.topic ?? "single"}
                portfolioId={portfolioId}
                group={group}
                onApplied={onApplied}
              />
            ))}
          </section>
        ))}
      </div>
    </aside>
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
    <div className={isDecision ? "follow-up-card is-decision" : "follow-up-card"}>
      <p className="follow-up-eyebrow">{isDecision ? "핵심 결정" : "그 밖에"}</p>
      {/* 무엇에 대한 질문인지 짚어야 답의 범위가 정해진다. 저장소에서 본
          그대로라 지원자가 "아, 그거" 하고 떠올릴 수 있다. */}
      {group.topic ? <p className="follow-up-topic">{group.topic}</p> : null}

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

      <button className="button primary" type="button" aria-disabled={submitting} onClick={submit}>
        <SteadyLabel
          states={["이 자리 채우기", "다시 쓰는 중…"]}
          value={submitting ? "다시 쓰는 중…" : "이 자리 채우기"}
        />
      </button>

      {error ? <p className="inline-error" role="alert">{error}</p> : null}
    </div>
  );
}
