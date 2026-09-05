"use client";

import { useEffect, useRef, useState } from "react";
import {
  PORTFOLIO_ANSWER_MAX_LENGTH,
  type PortfolioQuestionDto,
  type PortfolioStatementResultDto,
} from "@/contracts/api-contract";
import { ApiClientError, apiClient } from "@/lib/api-client";
import { SteadyLabel } from "@/components/ui/SteadyLabel";

/**
 * 문서 옆에서 하나씩 되묻는 대화창.
 *
 * 처음에는 질문을 전부 펼친 폼이었다. 한 화면에 열 개가 넘게 쌓이면 사람이
 * 아무것도 답하지 않고 닫을 것 같아 물을 것을 8개로 묶어뒀는데, 그러다 보니
 * 저장소가 다섯이면 프로젝트마다 한두 개밖에 못 물었다. 폼을 유지하는 대가로
 * 물을 것을 버린 셈이다.
 *
 * 대화창은 한 번에 하나만 보여준다. 목록이 길어도 부담이 되지 않으므로 물을
 * 것을 줄일 이유가 없어진다. 답하는 방식도 이력서 칸을 채우는 일보다 누가
 * 물어봐서 대답하는 일에 가깝고, 우리가 원하는 것이 정확히 그것이다 —
 * 지원자가 면접에서 하듯 자기 말로 답하는 것.
 *
 * 결정은 셋이 모여야 문서에 들어간다. 대화창은 그 셋을 차례로 물어 모은 뒤
 * 한 번에 보낸다. 폼이었을 때 "세 가지를 다 알려주셔야" 하고 되돌려 보내야
 * 했던 일이 여기서는 그냥 대화의 순서가 된다.
 */

const FIELD_LABEL: Record<PortfolioQuestionDto["field"], string> = {
  impact: "성과",
  challenges: "문제",
  solutions: "해결",
  role: "역할",
  highlights: "강조",
  decisionProblem: "결정 · 문제",
  decisionApproach: "결정 · 선택",
  decisionOutcome: "결정 · 결과",
};

/** 대화에 쌓이는 줄. */
type Turn =
  | { kind: "answer"; id: string; text: string }
  | { kind: "note"; id: string; text: string };

export type RailProject = {
  /** 문서에서 이 프로젝트를 찾는 열쇠. */
  url: string;
  name: string;
  title: string;
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

/** 같은 결정에 속한 질문인지. 셋이 모여야 문서에 들어간다. */
function sameDecision(a: PortfolioQuestionDto, b: PortfolioQuestionDto): boolean {
  return Boolean(a.topic) && a.topic === b.topic && a.repositoryName === b.repositoryName;
}

export function FollowUpRail({
  portfolioId,
  questions,
  projects,
  open,
  onClose,
  onApplied,
}: {
  portfolioId: string;
  /** 답한 것과 아직 답하지 않은 것 모두. 답한 것은 지난 대화로 보여준다. */
  questions: PortfolioQuestionDto[];
  /** 문서에 나오는 프로젝트. 질문이 어느 프로젝트 이야기인지 잇는 데 쓴다. */
  projects: RailProject[];
  open: boolean;
  onClose: () => void;
  onApplied: (result: PortfolioStatementResultDto) => void;
}) {
  /* 대화 순서를 열 때 한 번 정하고 그대로 쓴다.
     답할 때마다 다시 계산하면 방금 답한 질문이 목록에서 빠지면서 커서가
     가리키는 자리가 밀려, 다음 질문 하나가 통째로 건너뛰어진다. */
  const [queue] = useState(() => questions.filter((question) => !question.answer));
  const [history] = useState(() => questions.filter((question) => question.answer));
  const [cursor, setCursor] = useState(0);
  const [draft, setDraft] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /* 아직 보내지 않고 모으는 중인 결정 답변. 셋이 차면 한 번에 보낸다. */
  const pending = useRef<Array<{ questionId: string; answer: string }>>([]);
  const endRef = useRef<HTMLDivElement>(null);

  // 새 줄이 쌓이면 마지막이 보이게 한다. 대화창의 기본 동작이다.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [turns.length, cursor]);

  if (!open || questions.length === 0) return null;

  const current = queue[cursor] ?? null;
  const remaining = Math.max(queue.length - cursor, 0);

  const projectOf = (question: PortfolioQuestionDto) =>
    projects.find((project) => project.name === question.repositoryName) ?? null;

  /** 이 질문이 결정 묶음의 마지막인지. 마지막이면 모아둔 것을 보낸다. */
  const isGroupComplete = (question: PortfolioQuestionDto, index: number) => {
    if (!question.topic) return true;
    const next = queue[index + 1];
    return !next || !sameDecision(question, next);
  };

  const send = async () => {
    const text = draft.trim();
    if (!current || submitting || !text) return;
    if ([...text].length > PORTFOLIO_ANSWER_MAX_LENGTH) {
      setError(`답변은 ${PORTFOLIO_ANSWER_MAX_LENGTH}자 이내로 줄여주세요.`);
      return;
    }

    setError(null);
    setDraft("");
    setTurns((previous) => [...previous, { kind: "answer", id: `${current.id}-said`, text }]);
    pending.current = [...pending.current, { questionId: current.id, answer: text }];

    /* 결정은 셋이 모여야 문서에 들어간다. 아직 모이는 중이면 다음 질문으로
       넘어가기만 한다 — 폼이었을 때 "세 가지를 다 알려주셔야" 하고 되돌려
       보내던 일이 여기서는 대화의 순서가 된다. */
    if (!isGroupComplete(current, cursor)) {
      setCursor(cursor + 1);
      return;
    }

    const batch = pending.current;
    pending.current = [];
    setSubmitting(true);
    try {
      const result = await apiClient.applyPortfolioStatements(portfolioId, batch);
      onApplied(result);
      setTurns((previous) => [...previous, {
        kind: "note",
        id: `${current.id}-note`,
        text: result.updatedFields.length > 0
          ? "문서의 그 자리를 채웠어요."
          : "쓸 내용을 찾지 못했어요. 조금 더 구체적으로 적어주시면 반영할 수 있어요.",
      }]);
      setCursor(cursor + 1);
    } catch (caught) {
      /* 근거가 사라진 결과는 다시 시도해도 되지 않는다. 같은 문구로 뭉뚱그리면
         사용자가 될 때까지 누르게 된다. */
      setError(
        caught instanceof ApiClientError && caught.code === "EVIDENCE_UNAVAILABLE"
          ? "이 포트폴리오는 생성 근거가 남아 있지 않아 다시 쓸 수 없어요. 새로 만들면 답변을 반영할 수 있어요."
          : "답변을 반영하지 못했어요. 잠시 후 다시 시도해주세요.",
      );
      // 보내지 못한 답을 되돌린다. 다시 보낼 때 처음부터 묻지 않게.
      pending.current = batch;
    } finally {
      setSubmitting(false);
    }
  };

  /** 건너뛰기. 결정은 셋이 한 덩어리라 묶음째 넘긴다. */
  const skip = () => {
    if (!current || submitting) return;
    let next = cursor + 1;
    while (queue[next] && sameDecision(current, queue[next])) next += 1;
    pending.current = [];
    setDraft("");
    setError(null);
    setTurns((previous) => [...previous, {
      kind: "note",
      id: `${current.id}-skip`,
      text: current.topic ? "이 결정은 건너뛸게요." : "이 질문은 건너뛸게요.",
    }]);
    setCursor(next);
  };

  return (
    <aside className="follow-up-rail" aria-label="더 알려주기">
      <header className="follow-up-rail-head">
        <div>
          <p className="mono-label">MISSING CONTEXT</p>
          <strong>{remaining > 0 ? `답할 것 ${remaining}개` : "다 채웠어요"}</strong>
        </div>
        <button className="text-link" type="button" onClick={onClose}>닫기</button>
      </header>

      <div className="follow-up-log">
        {/* 지난 대화. 다시 열었을 때 무엇을 답했는지 이어 보인다. */}
        {history.map((question) => (
          <div className="follow-up-past" key={question.id}>
            <Ask question={question} project={projectOf(question)} />
            <p className="follow-up-said">{question.answer}</p>
          </div>
        ))}

        {/* 이번에 답한 것. 물음과 답이 번갈아 쌓인다. */}
        {queue.slice(0, cursor).map((question, index) => {
          const said = turns.find((turn) => turn.id === `${question.id}-said`);
          const note = turns.find((turn) => turn.id === `${question.id}-note` || turn.id === `${question.id}-skip`);
          return (
            <div key={`${question.id}-${index}`}>
              <Ask question={question} project={projectOf(question)} />
              {said?.kind === "answer" ? <p className="follow-up-said">{said.text}</p> : null}
              {note ? <p className="follow-up-note" role="status">{note.text}</p> : null}
            </div>
          );
        })}

        {current ? (
          <Ask question={current} project={projectOf(current)} />
        ) : (
          <p className="follow-up-note" role="status">
            물어볼 것이 더 없어요. 답해주신 내용은 문서에 들어가 있어요.
          </p>
        )}

        {error ? <p className="inline-error" role="alert">{error}</p> : null}
        <div ref={endRef} />
      </div>

      {/* 입력은 아래에 붙는다. 대화창이 늘 그렇듯 답하는 자리가 한 곳이어야
          다음에 무엇을 해야 하는지 찾을 필요가 없다. */}
      {current ? (
        <div className="follow-up-composer">
          <textarea
            value={draft}
            rows={2}
            placeholder="있었던 일을 그대로 적어주세요. 수치가 없어도 괜찮아요."
            aria-label="답변"
            onChange={(event) => {
              setDraft(event.target.value);
              // 고친 뒤에도 옛 오류가 남아 있으면 문구가 거짓말이 된다.
              setError(null);
            }}
            onKeyDown={(event) => {
              /* 줄바꿈은 Shift+Enter. 한글 입력 중의 Enter는 조합을 확정하는
                 키라, 그때 보내면 쓰던 글자가 잘린 채 나간다. */
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                void send();
              }
            }}
          />
          <div>
            <button className="text-link" type="button" aria-disabled={submitting} onClick={skip}>
              건너뛰기
            </button>
            <button
              className="button primary"
              type="button"
              aria-disabled={submitting || draft.trim().length === 0}
              onClick={() => void send()}
            >
              {/* 두 문구의 폭이 달라 그대로 바꾸면 버튼이 눌린 뒤에 흔들린다. */}
              <SteadyLabel states={["보내기", "쓰는 중…"]} value={submitting ? "쓰는 중…" : "보내기"} />
            </button>
          </div>
        </div>
      ) : null}
    </aside>
  );
}

/**
 * 질문.
 *
 * 어느 프로젝트의 어느 자리를 채우는지 머리에 적는다. 답을 어디에 쓸지 알아야
 * 답의 범위가 정해진다. 누르면 문서에서 그곳으로 간다.
 */
function Ask({
  question,
  project,
}: {
  question: PortfolioQuestionDto;
  project: RailProject | null;
}) {
  return (
    <div className="follow-up-ask">
      {project ? (
        <button
          className="follow-up-ask-source"
          type="button"
          onClick={() => findProjectBlock(project.url)?.scrollIntoView({ behavior: "smooth", block: "center" })}
          onMouseEnter={() => findProjectBlock(project.url)?.classList.add("result-block-active")}
          onMouseLeave={() => findProjectBlock(project.url)?.classList.remove("result-block-active")}
          onFocus={() => findProjectBlock(project.url)?.classList.add("result-block-active")}
          onBlur={() => findProjectBlock(project.url)?.classList.remove("result-block-active")}
        >
          {project.title} · {FIELD_LABEL[question.field]}
        </button>
      ) : null}
      {/* 무엇에 대한 질문인지 짚어야 답의 범위가 정해진다. 저장소에서 본
          그대로라 지원자가 "아, 그거" 하고 떠올릴 수 있다. */}
      {question.topic ? <p className="follow-up-topic">{question.topic}</p> : null}
      <p className="follow-up-ask-text">{question.question}</p>
    </div>
  );
}
