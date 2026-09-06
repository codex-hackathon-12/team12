"use client";

import type { PortfolioDecisionCandidateDto, PortfolioQuestionSlot } from "@/contracts/api-contract";
import type { RailProject } from "@/components/portfolio/FollowUpRail";

/**
 * 아직 안 쓴 자리를 여는 카드.
 *
 * 되묻기 카드 안에 얹혀 있었다. 그러면 한 카드가 두 가지 일을 한다 — 오간
 * 대화를 읽는 곳과 무엇을 더 쓸지 고르는 곳. 대화 중간에 조작 줄이 끼어들어
 * 어디까지가 대화인지 흐려졌다. 카드를 나눠 각자 한 가지만 하게 한다.
 *
 * 상태는 갖지 않는다. 무엇을 고를 수 있고 지금 무엇을 여는 중인지는 대화가
 * 알고 있으므로 그대로 받아 그린다 — 여는 순간 대화의 질문 순서가 바뀌기
 * 때문에 둘이 같은 상태를 봐야 한다.
 */

export type WriteAction = {
  project: RailProject;
  slot: PortfolioQuestionSlot;
  /** 이미 쓰인 결정을 다른 결정으로 바꾸는 자리. */
  replace: boolean;
};

export type DecisionChoice = {
  project: RailProject;
  replace: boolean;
  /** 아직 불러오는 중이면 null. */
  candidates: PortfolioDecisionCandidateDto[] | null;
};

const SLOT_LABEL: Record<PortfolioQuestionSlot, string> = {
  keyDecision: "핵심 결정",
  highlights: "강조",
};

export function MoreToWrite({
  actions,
  choosing,
  busy,
  onChoose,
  onOpen,
  onCancel,
}: {
  actions: WriteAction[];
  /** 결정 후보를 고르는 중이면 그 대상. */
  choosing: DecisionChoice | null;
  busy: boolean;
  onChoose: (project: RailProject, replace: boolean) => void;
  onOpen: (project: RailProject, slot: PortfolioQuestionSlot, options?: { topic?: string; replace?: boolean }) => void;
  onCancel: () => void;
}) {
  if (!choosing && actions.length === 0) return null;

  return (
    <aside className="follow-up-more" aria-label="더 쓸 자리">
      {choosing ? (
        <>
          <p className="follow-up-more-head">{choosing.project.title} · 어느 결정을 쓸까요?</p>
          {choosing.candidates === null ? (
            <p className="follow-up-status">
              <span className="loading-mark-inline" aria-hidden="true" />
              저장소를 읽는 중…
            </p>
          ) : (
            <ul className="follow-up-candidates">
              {/* 저장소에서 본 그대로다. 다듬으면 본인이 못 알아본다. */}
              {choosing.candidates.map((candidate) => (
                <li key={candidate.topic}>
                  <button
                    type="button"
                    aria-disabled={busy}
                    onClick={() => onOpen(choosing.project, "keyDecision", {
                      topic: candidate.topic,
                      replace: choosing.replace,
                    })}
                  >
                    <span>{candidate.topic}</span>
                    {/* 어디서 온 줄인지 알아야 저장소에서 찾아볼 수 있다. */}
                    <em>{candidate.source === "pullRequest" ? "PR" : "커밋"}</em>
                  </button>
                </li>
              ))}
              {/* 후보가 없어도 막지 않는다. 생성 근거가 남아 있지 않은 오래된
                  포트폴리오가 있고, 후보를 못 뽑는 것과 결정을 못 쓰는 것은
                  다른 일이다. */}
              <li>
                <button
                  type="button"
                  aria-disabled={busy}
                  onClick={() => onOpen(choosing.project, "keyDecision", { replace: choosing.replace })}
                >
                  <span>직접 쓸래요</span>
                </button>
              </li>
            </ul>
          )}
          <button className="follow-up-cancel" type="button" onClick={onCancel}>그만두기</button>
        </>
      ) : (
        <>
          <p className="follow-up-more-head">더 쓸 자리</p>
          <div className="follow-up-more-actions">
            {actions.map(({ project, slot, replace }) => (
              <button
                key={`${project.name} ${slot} ${replace}`}
                type="button"
                aria-disabled={busy}
                onClick={() => (slot === "keyDecision"
                  ? onChoose(project, replace)
                  : onOpen(project, slot))}
              >
                {project.title} · {replace ? "다른 결정으로" : SLOT_LABEL[slot]}
              </button>
            ))}
          </div>
        </>
      )}
    </aside>
  );
}
