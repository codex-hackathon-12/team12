"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  PORTFOLIO_ANSWER_MAX_LENGTH,
  type PortfolioQuestionDto,
  type PortfolioStatementResultDto,
} from "@/contracts/api-contract";
import { ApiClientError, apiClient } from "@/lib/api-client";

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
  onApplied: (result: PortfolioStatementResultDto) => void;
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
  const [notes, setNotes] = useState<Record<string, string>>({});
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

  const projectOf = (question: PortfolioQuestionDto) =>
    projects.find((project) => project.name === question.repositoryName) ?? null;

  /** 같은 결정에 속한 질문 전부. 셋이 한 덩어리다. */
  const groupOf = (question: PortfolioQuestionDto) =>
    question.topic
      ? timeline.filter((item) => sameDecision(question, item))
      : [question];

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
    if (batch.length < group.length) return;

    setSubmitting(true);
    try {
      const result = await apiClient.applyPortfolioStatements(portfolioId, batch);
      onApplied(result);
      setNotes((previous) => ({
        ...previous,
        [current.id]: result.updatedFields.length > 0
          ? "문서의 그 자리를 채웠어요."
          : "쓸 내용을 찾지 못했어요. 조금 더 구체적으로 적어주시면 반영할 수 있어요.",
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
    setNotes((previous) => ({
      ...previous,
      [current.id]: current.topic ? "이 결정은 건너뛸게요." : "이 질문은 건너뛸게요.",
    }));
    setDraft("");
    setEditing(null);
    setError(null);
  };

  return (
    <aside className="follow-up-rail" aria-label="더 알려주기">
      {/* 노션 카드에는 큰 머리가 없다. 남은 개수와 닫기만 얇게. */}
      <header className="follow-up-rail-head">
        <span>{remaining > 0 ? `답할 것 ${remaining}개` : "다 채웠어요"}</span>
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
          if (question.id === current?.id) return null;
          const answer = answers[question.id];
          const note = notes[question.id];
          if (!answer && !note) return null;
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
              {note ? <p className="follow-up-note" role="status">{note}</p> : null}
            </div>
          );
        })}

        {current ? (
          <Ask
            question={current}
            project={projectOf(current)}
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
  onSkip,
}: {
  question: PortfolioQuestionDto;
  project: RailProject | null;
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
