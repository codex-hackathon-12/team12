"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  PORTFOLIO_ANSWER_MAX_LENGTH,
  type PortfolioQuestionDto,
  type PortfolioStatementResultDto,
} from "@/contracts/api-contract";
import { ApiClientError, apiClient } from "@/lib/api-client";
import { SLOT_LABEL, type RewriteChange } from "@/lib/rewrite-summary";

/**
 * 문서 옆의 댓글 스레드. 노션 댓글이 원형이다.
 *
 * 세 번째 시도다. 처음에는 화면 끝에 붙은 전체 높이 슬래브, 다음에는 배경을
 * 전부 걷어낸 맨살 텍스트 — 앞은 화면 위에 얹힌 판이었고 뒤는 담기지 않아
 * 흩어져 보였다. 노션 참고본이 보여주는 것은 그 중간이다: **작고 잘 담긴
 * 둥근 카드** 안에 아바타 달린 말풍선이 쌓이고, 아래에 알약형 회신 입력이
 * 있다. 이 앱은 전부 각진 모서리지만 이 카드만 노션을 따른다 — 참고 이미지가
 * 이 컴포넌트에 대한 지시였다.
 *
 * 대화는 하나씩 묻는다. 목록이 길어도 부담이 되지 않으므로 물을 것을 줄일
 * 이유가 없고, 답하는 일도 이력서 칸을 채우는 것보다 물어봐서 대답하는 것에
 * 가까워진다 — 지원자가 면접에서 하듯 자기 말로.
 *
 * 결정은 셋이 모여야 문서에 들어간다. 셋을 차례로 물어 모은 뒤 한 번에
 * 보낸다. 폼이었을 때 "세 가지를 다 알려주셔야" 하고 되돌려 보내던 일이
 * 여기서는 대화의 순서가 된다.
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

/**
 * 한 턴이 어떻게 됐는지.
 *
 * 예전에는 문자열 한 줄이었다("문서의 그 자리를 채웠어요"). 그래서 답을
 * 보내고 나면 **무엇이 어떻게 됐는지 알 방법이 없었다.** 게다가 이 줄은
 * 성공했을 때만 붙어서, 결정 조각을 모으는 동안과 보내는 동안은 화면이
 * 아무 말도 하지 않았다 — 답을 두 번 연속 쓰고도 아무 반응이 없다.
 *
 * 턴마다 지금 어느 상태인지를 담는다. 상태가 있으면 화면이 매 순간 무언가를
 * 말할 수 있다.
 */
type TurnResult =
  /** 결정 조각을 받았지만 아직 셋이 아니다. 서버에 가지도 않는 구간이다. */
  | { kind: "collecting"; got: number; total: number }
  /** 서버에 보내는 중. 모델 호출이라 몇 초씩 걸린다. */
  | { kind: "writing"; target: string }
  | { kind: "changed"; changes: RewriteChange[] }
  /** 반영할 문장이 나오지 않았다. */
  | { kind: "unchanged"; answerHadNumber: boolean }
  | { kind: "skipped"; decision: boolean };

export type RailProject = {
  /** 문서에서 이 프로젝트를 찾는 열쇠. */
  url: string;
  name: string;
  title: string;
};

/** 답하는 사람. 말풍선의 아바타와 이름 줄에 쓴다. */
export type RailProfile = {
  displayName: string;
  avatarUrl: string | null;
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
  profile,
  open,
  onClose,
  onApplied,
}: {
  portfolioId: string;
  /** 답한 것과 아직 답하지 않은 것 모두. 답한 것은 지난 대화로 보여준다. */
  questions: PortfolioQuestionDto[];
  /** 문서에 나오는 프로젝트. 질문이 어느 프로젝트 이야기인지 잇는 데 쓴다. */
  projects: RailProject[];
  profile: RailProfile;
  open: boolean;
  onClose: () => void;
  /**
   * 반영된 결과를 넘기고, **무엇이 바뀌었는지 돌려받는다.**
   *
   * 이전 `content`를 아는 곳은 문서를 들고 있는 화면뿐이다. 카드는 보내고,
   * 화면은 문서를 갈아끼우며 무엇이 움직였는지 답한다 — 상태를 한 번 더
   * 왕복시키거나 이펙트로 이전 값을 복사해두는 것보다 짧고, 어느 턴의
   * 결과인지도 호출한 쪽이 그대로 안다.
   */
  onApplied: (result: PortfolioStatementResultDto) => RewriteChange[];
}) {
  /* 대화 순서를 열 때 한 번 정하고 그대로 쓴다. 답한 것도 함께 담는다.
     답할 때마다 다시 계산하면 방금 답한 질문이 목록에서 빠지면서 자리가
     밀려, 다음 질문 하나가 통째로 건너뛰어진다. */
  const [timeline] = useState(() => questions);
  /* 화면에 보이는 답의 단일 출처. 서버가 준 답으로 씨를 뿌리고 이 자리에서
     갱신한다. 고쳐 쓰기가 가능하려면 답이 한 곳에 모여 있어야 한다. */
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      questions.filter((question) => question.answer).map((question) => [question.id, question.answer as string]),
    ),
  );
  const [skipped, setSkipped] = useState<Record<string, true>>({});
  /** 지금 고쳐 쓰는 중인 질문. 없으면 첫 미답을 묻는다. */
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  /** 턴마다의 진행과 결과. 답한 말풍선 아래에 그대로 붙는다. */
  const [results, setResults] = useState<Record<string, TurnResult>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const pendingIndex = timeline.findIndex(
    (question) => !answers[question.id] && !skipped[question.id],
  );

  // 새 줄이 쌓이면 마지막이 보이게 한다. 대화창의 기본 동작이다.
  useEffect(() => {
    if (!editing) endRef.current?.scrollIntoView({ block: "end" });
  }, [pendingIndex, editing]);

  if (!open || questions.length === 0) return null;

  const current = editing
    ? timeline.find((question) => question.id === editing) ?? null
    : timeline[pendingIndex] ?? null;
  const remaining = timeline.filter(
    (question) => !answers[question.id] && !skipped[question.id],
  ).length;
  /* 이번 대화에서 문서가 몇 곳 바뀌었는지. 같은 자리를 두 번 고쳐도 한 곳이다. */
  const changedSlots = new Set(
    Object.values(results).flatMap((result) =>
      result.kind === "changed" ? result.changes.map((change) => `${change.projectUrl} ${change.slot}`) : [],
    ),
  ).size;

  const projectOf = (question: PortfolioQuestionDto) =>
    projects.find((project) => project.name === question.repositoryName) ?? null;

  /** 같은 결정에 속한 질문 전부. 셋이 한 덩어리다. */
  const groupOf = (question: PortfolioQuestionDto) =>
    question.topic
      ? timeline.filter((item) => sameDecision(question, item))
      : [question];

  /** 결정 묶음에서 지금 몇 번째를 묻고 있는지. 낱개 질문은 없다. */
  const stepOf = (question: PortfolioQuestionDto) => {
    const group = groupOf(question);
    if (group.length < 2) return null;
    return { index: group.indexOf(question) + 1, total: group.length };
  };

  /** 질문이 채우는 자리를 사람 말로. "folio · 핵심 결정" */
  const targetOf = (question: PortfolioQuestionDto) => {
    const project = projectOf(question);
    return project ? `${project.title} · ${FIELD_LABEL[question.field]}` : FIELD_LABEL[question.field];
  };

  /** 문서의 그 블록으로 데려간다. 이름 줄 꼬리가 쓰는 통로와 같다. */
  const showBlock = (url: string) =>
    findProjectBlock(url)?.scrollIntoView({ behavior: "smooth", block: "center" });

  const beginEdit = (question: PortfolioQuestionDto) => {
    if (submitting) return;
    setEditing(question.id);
    setDraft(answers[question.id] ?? "");
    setError(null);
  };

  const send = async () => {
    const text = draft.trim();
    if (!current || submitting || !text) return;
    if ([...text].length > PORTFOLIO_ANSWER_MAX_LENGTH) {
      setError(`답변은 ${PORTFOLIO_ANSWER_MAX_LENGTH}자 이내로 줄여주세요.`);
      return;
    }

    const next = { ...answers, [current.id]: text };
    setAnswers(next);
    // 건너뛰었던 질문에 다시 답하면 건너뜀 표시를 지운다.
    setSkipped((previous) => {
      if (!previous[current.id]) return previous;
      const rest = { ...previous };
      delete rest[current.id];
      return rest;
    });
    setDraft("");
    setEditing(null);
    setError(null);

    /* 결정은 셋이 모여야 문서에 들어간다. 아직 다 안 모였으면 보내지 않고
       다음 조각을 묻는다 — 폼이었을 때 "세 가지를 다 알려주셔야" 하고 되돌려
       보내던 일이 대화에서는 순서가 된다.

       고쳐 쓸 때도 같은 규칙이다. 한 조각만 보내면 서버는 나머지를 모르는
       채 재작성해 반쪽짜리가 되므로, 묶음 셋을 모두 함께 보낸다. */
    const group = groupOf(current);
    const batch = group
      .filter((question) => next[question.id])
      .map((question) => ({ questionId: question.id, answer: next[question.id] }));
    if (batch.length < group.length) {
      /* 여기가 예전에 아무 말도 없던 구간이다. 답을 받아 뒀지만 서버에 가지도
         않으므로, 사용자 눈에는 두 번 연속으로 답했는데 문서도 안 바뀌고
         설명도 없는 것으로 보였다. 진행을 말해준다.

         묶음 안의 지난 진행은 지운다. 진행 줄이 여럿 남으면
         나란히 남으면 어느 쪽이 지금인지 알 수 없다. */
      setResults((previous) => {
        const rest = { ...previous };
        for (const question of group) {
          if (rest[question.id]?.kind === "collecting") delete rest[question.id];
        }
        return { ...rest, [current.id]: { kind: "collecting", got: batch.length, total: group.length } };
      });
      return;
    }

    setSubmitting(true);
    setResults((previous) => ({ ...previous, [current.id]: { kind: "writing", target: targetOf(current) } }));
    try {
      const result = await apiClient.applyPortfolioStatements(portfolioId, batch);
      const changes = onApplied(result);
      setResults((previous) => ({
        ...previous,
        [current.id]: changes.length > 0
          ? { kind: "changed", changes }
          /* 답은 저장됐다. 문장이 안 나온 이유는 응답만으로 가릴 수 없다 —
             모델이 못 살렸을 수도, 수치 검증이 근거에 없는 숫자를 지웠을
             수도 있다. 사용자를 탓하는 대신 규칙을 말한다. */
          : { kind: "unchanged", answerHadNumber: /\d/u.test(text) },
      }));
    } catch (caught) {
      /* 근거가 사라진 결과는 다시 시도해도 되지 않는다. 같은 문구로 뭉뚱그리면
         사용자가 될 때까지 누르게 된다. */
      setError(
        caught instanceof ApiClientError && caught.code === "EVIDENCE_UNAVAILABLE"
          ? "이 포트폴리오는 생성 근거가 남아 있지 않아 다시 쓸 수 없어요. 새로 만들면 답변을 반영할 수 있어요."
          : "답변을 반영하지 못했어요. 잠시 후 다시 시도해주세요.",
      );
      /* 답은 화면에 남겨둔다. 지우면 사용자가 방금 쓴 글을 잃고, 답이 남아
         있으면 "다시 답하기"로 그대로 다시 보낼 수 있다. */
      // "쓰는 중"을 남겨두면 화면이 거짓말을 한다. 오류 줄이 대신 말한다.
      setResults((previous) => {
        const rest = { ...previous };
        delete rest[current.id];
        return rest;
      });
    } finally {
      setSubmitting(false);
    }
  };

  /** 건너뛰기. 결정은 셋이 한 덩어리라 묶음째 넘긴다. */
  const skip = () => {
    if (!current || submitting) return;
    const group = groupOf(current);
    setSkipped((previous) => ({
      ...previous,
      ...Object.fromEntries(group.map((question) => [question.id, true as const])),
    }));
    setResults((previous) => ({
      ...previous,
      [current.id]: { kind: "skipped", decision: Boolean(current.topic) },
    }));
    setDraft("");
    setEditing(null);
    setError(null);
  };

  return (
    <aside className="follow-up-rail" aria-label="더 알려주기">
      {/* 노션 카드에는 큰 머리가 없다. 남은 개수와 닫기만 얇게. */}
      <header className="follow-up-rail-head">
        {/* 남은 것과 함께 이번 대화의 성과를 적는다. 답이 문서에 쌓이고
            있다는 것을 남은 개수만으로는 알 수 없다. */}
        <span>
          {remaining > 0 ? `답할 것 ${remaining}개` : "다 채웠어요"}
          {changedSlots > 0 ? ` · 문서 ${changedSlots}곳 바뀜` : ""}
        </span>
        <button className="text-link" type="button" onClick={onClose}>닫기</button>
      </header>

      <div className="follow-up-log">
        {/* 답의 기준은 한 번만 말한다. 질문마다 반복하면 잔소리가 된다. */}
        {remaining > 0 ? (
          <p className="follow-up-note">
            있었던 일을 그대로 적어주세요. 수치가 없어도 괜찮아요.
          </p>
        ) : null}

        {/* 지나온 대화. 지난 방문에서 답한 것과 방금 답한 것을 한 흐름으로
            보여준다 — 둘을 갈라두면 어느 쪽이 최신인지 알기 어렵다. */}
        {timeline.map((question) => {
          const answer = answers[question.id];
          const result = results[question.id];
          /* 지금 묻는 질문은 아래에서 그린다. 고쳐 쓰는 중이라면 지난 결과가
             남아 있는데, 그것까지 여기 띄우면 아직 안 보낸 답의 결과가 이미
             난 것처럼 보인다. */
          if (question.id === current?.id) return null;
          if (!answer && !result) return null;
          return (
            <div key={question.id}>
              <Ask question={question} project={projectOf(question)} />
              {answer ? (
                <Said
                  profile={profile}
                  text={answer}
                  onEdit={submitting ? undefined : () => beginEdit(question)}
                />
              ) : null}
              {result ? <Applied result={result} onShow={showBlock} /> : null}
            </div>
          );
        })}

        {current ? (
          <Ask
            question={current}
            project={projectOf(current)}
            step={stepOf(current)}
            onSkip={submitting || editing ? undefined : skip}
          />
        ) : (
          <p className="follow-up-note" role="status">
            물어볼 것이 더 없어요. 답해주신 내용은 문서에 들어가 있어요.
          </p>
        )}

        {error ? <p className="inline-error" role="alert">{error}</p> : null}
        <div ref={endRef} />
      </div>

      {/* 회신 줄. 노션처럼 알약형 입력 안에 원형 전송 버튼을 둔다.
          아이콘이라 문구 스왑이 없어 전송 중에도 폭이 흔들리지 않는다. */}
      {current ? (
        <div className="follow-up-composer">
          <textarea
            value={draft}
            rows={1}
            placeholder="답변..."
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
          <button
            className="follow-up-send"
            type="button"
            aria-label="보내기"
            aria-disabled={submitting || draft.trim().length === 0}
            onClick={() => void send()}
          >
            ↑
          </button>
          {/* 고쳐 쓰다 그만둘 길. 없으면 원래 자리로 돌아갈 방법이 없다. */}
          {editing ? (
            <button
              className="follow-up-cancel"
              type="button"
              onClick={() => {
                setEditing(null);
                setDraft("");
                setError(null);
              }}
            >
              고쳐 쓰기 취소
            </button>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}

/**
 * 묻는 말풍선. 노션의 댓글 행 — 아바타, 이름 줄, 본문.
 *
 * 이름 줄의 회색 꼬리가 어느 프로젝트의 어느 자리를 채우는 질문인지 짚는다.
 * 답을 어디에 쓸지 알아야 답의 범위가 정해진다. 누르면 문서에서 그곳으로 간다.
 */
function Ask({
  question,
  project,
  step,
  onSkip,
}: {
  question: PortfolioQuestionDto;
  project: RailProject | null;
  /** 결정 묶음의 몇 번째인지. 낱개 질문은 null이다. */
  step?: { index: number; total: number } | null;
  /** 지금 물어보는 중인 질문에만 붙는다. */
  onSkip?: () => void;
}) {
  return (
    <div className="follow-up-ask">
      <span className="follow-up-avatar follow-up-avatar-bot" aria-hidden="true">F/</span>
      <div>
        <p className="follow-up-name">
          folio.ai
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
          {/* 결정은 셋이 모여야 문서에 들어간다. 몇 번째인지 안 적으면 왜
              비슷한 질문이 계속 오는지, 언제 끝나는지 알 수 없다. */}
          {step ? <span className="follow-up-step">{step.index}/{step.total}</span> : null}
          {onSkip ? (
            <button className="follow-up-skip" type="button" onClick={onSkip}>건너뛰기</button>
          ) : null}
        </p>
        {/* 무엇에 대한 질문인지 짚어야 답의 범위가 정해진다. 저장소에서 본
            그대로라 지원자가 "아, 그거" 하고 떠올릴 수 있다. */}
        {question.topic ? <p className="follow-up-topic">{question.topic}</p> : null}
        <p className="follow-up-ask-text">{question.question}</p>
      </div>
    </div>
  );
}

/**
 * 답을 보낸 뒤 무슨 일이 일어났는지.
 *
 * 예전에는 "문서의 그 자리를 채웠어요" 한 줄이 전부였다. 어느 프로젝트의
 * 어느 문단이 무엇에서 무엇으로 바뀌었는지는 어디에도 없었고, 바뀐 문장이
 * 화면 밖이나 다른 A4 장에 있으면 아무 일도 안 일어난 것처럼 보였다.
 *
 * 이전과 지금을 나란히 둔다. 문서로 가지 않아도 그 자리에서 견줄 수 있다.
 * 자동으로 문서를 스크롤하지는 않는다 — 이 카드가 문서와 함께 움직이므로
 * 자동으로 뛰면 대화가 화면 밖으로 밀려난다.
 */
function Applied({ result, onShow }: { result: TurnResult; onShow: (url: string) => void }) {
  if (result.kind === "collecting") {
    return (
      <p className="follow-up-status" role="status">
        {result.total}개 중 {result.got}개 받았어요. 셋이 모이면 문서에 써요.
      </p>
    );
  }

  if (result.kind === "writing") {
    return (
      <p className="follow-up-status" role="status">
        <span className="loading-mark-inline" aria-hidden="true" />
        {result.target}에 쓰는 중…
      </p>
    );
  }

  if (result.kind === "skipped") {
    return (
      <p className="follow-up-status" role="status">
        {result.decision ? "이 결정은 건너뛸게요." : "이 질문은 건너뛸게요."}
      </p>
    );
  }

  if (result.kind === "unchanged") {
    return (
      <p className="follow-up-status" role="status">
        답은 저장했는데 문서에 넣을 문장이 나오지 않았어요.
        {result.answerHadNumber
          ? " 저장소 근거에 없는 숫자는 문서에 쓰지 않아요 — 숫자 없이 있었던 일로 다시 답해보실래요?"
          : " 다시 답하기로 조금 더 적어주시면 반영할 수 있어요."}
      </p>
    );
  }

  return (
    <div className="follow-up-changes">
      <p className="follow-up-status">문서가 바뀌었어요</p>
      {result.changes.map((change) => (
        <div className="follow-up-change" key={`${change.projectUrl} ${change.slot}`}>
          <p className="follow-up-change-head">
            <span>{change.projectTitle} · {SLOT_LABEL[change.slot]}</span>
            <button className="follow-up-change-show" type="button" onClick={() => onShow(change.projectUrl)}>
              문서에서 보기
            </button>
          </p>
          {/* 이름과 값이라 목록으로 둔다. 강조점은 기존 항목 뒤에 붙는
              자리라 "이전"이 비어 있는데, 그걸 "비어 있었어요"로 읽으면
              멀쩡히 있던 문장을 없던 것으로 만든다. */}
          <dl>
            {change.mode === "replaced" ? (
              <>
                <dt>이전</dt>
                <dd className="follow-up-change-old">{change.before.join(" ")}</dd>
              </>
            ) : null}
            <dt>{change.mode === "added" ? "추가" : "지금"}</dt>
            {/* 줄마다 따로 둔다. 결정은 표제와 세 문장이고 강조는 여러
                항목이라, 이어 붙이면 한 덩어리 글이 되어 안 읽힌다. */}
            <dd>{change.after.map((line) => <span key={line}>{line}</span>)}</dd>
          </dl>
        </div>
      ))}
    </div>
  );
}

/**
 * 답한 말풍선. 같은 행 구조에 아바타만 사용자다 — 노션에서 회신이 그렇듯.
 *
 * "다시 답하기"가 붙는다. 서버는 질문 id로 답을 덮어쓰므로 재답변이 원래
 * 가능했는데, 화면에 통로가 없어 한 번 보내면 고칠 수 없었다.
 */
function Said({
  profile,
  text,
  onEdit,
}: {
  profile: RailProfile;
  text: string;
  onEdit?: () => void;
}) {
  const initial = profile.displayName.replace(/\s/gu, "").slice(0, 1) || "나";
  return (
    <div className="follow-up-ask follow-up-said">
      {profile.avatarUrl ? (
        <Image className="follow-up-avatar" src={profile.avatarUrl} alt="" width={24} height={24} />
      ) : (
        <span className="follow-up-avatar" aria-hidden="true">{initial}</span>
      )}
      <div>
        <p className="follow-up-name">
          {profile.displayName}
          {onEdit ? (
            <button className="follow-up-redo" type="button" onClick={onEdit}>다시 답하기</button>
          ) : null}
        </p>
        <p className="follow-up-ask-text">{text}</p>
      </div>
    </div>
  );
}
