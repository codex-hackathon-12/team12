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
  /**
   * 후보 불러오기가 실패했는지. 침묵하면 후보가 원래 없는 것과 실패가
   * 구분이 안 돼 고장처럼 보인다. 직접 쓰는 길은 그대로 열려 있다.
   */
  failed?: boolean;
};

const SLOT_LABEL: Record<PortfolioQuestionSlot, string> = {
  keyDecision: "핵심 결정",
  highlights: "강조",
};

export function MoreToWrite({
  actions,
  choosing,
  busy,
  opening,
  error,
  onChoose,
  onOpen,
  onCancel,
}: {
  actions: WriteAction[];
  /** 결정 후보를 고르는 중이면 그 대상. */
  choosing: DecisionChoice | null;
  busy: boolean;
  /**
   * 지금 여는 중인 자리("{저장소} {slot}"). 누른 칩만 "여는 중"이 된다 —
   * 전부 흐려지기만 하면 반응하는지 알 수 없다.
   */
  opening: string | null;
  /** 자리를 열다 난 오류. 행동한 카드 안에서 보여야 한다. */
  error: string | null;
  onChoose: (project: RailProject, replace: boolean) => void;
  onOpen: (project: RailProject, slot: PortfolioQuestionSlot, options?: { topic?: string; replace?: boolean }) => void;
  onCancel: () => void;
}) {
  if (!choosing && actions.length === 0) return null;

  const openingLabel = (
    <span className="follow-up-opening">
      <span className="loading-mark-inline" aria-hidden="true" />
      여는 중…
    </span>
  );

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
            <>
              {choosing.failed ? (
                <p className="follow-up-status">저장소 기록을 불러오지 못했어요. 직접 쓸 수는 있어요.</p>
              ) : null}
              <ul className="follow-up-candidates">
                {/* 저장소에서 본 그대로다. 다듬으면 본인이 못 알아본다. */}
                {choosing.candidates.map((candidate) => {
                  const busyHere = opening === `${choosing.project.name} keyDecision`;
                  return (
                    <li key={candidate.topic}>
                      <button
                        type="button"
                        aria-disabled={busy}
                        onClick={() => onOpen(choosing.project, "keyDecision", {
                          topic: candidate.topic,
                          replace: choosing.replace,
                        })}
                      >
                        <span className="follow-up-candidate-title">
                          {candidate.topic}
                          {/* 어디서 온 줄인지 알아야 저장소에서 찾아볼 수 있다. */}
                          <em>{busyHere ? "" : candidate.source === "pullRequest" ? "PR" : "커밋"}</em>
                        </span>
                        {/* 제목만으로는 어떤 작업이었는지 기억이 안 날 수 있다.
                            본문 첫 줄이 "왜"가 적힌 자리라 그것만으로 "아, 그거"가 된다. */}
                        {candidate.excerpt ? <small>{candidate.excerpt}</small> : null}
                      </button>
                    </li>
                  );
                })}
                {/* 후보가 없어도 막지 않는다. 생성 근거가 남아 있지 않은 오래된
                    포트폴리오가 있고, 후보를 못 뽑는 것과 결정을 못 쓰는 것은
                    다른 일이다. */}
                <li>
                  <button
                    type="button"
                    aria-disabled={busy}
                    onClick={() => onOpen(choosing.project, "keyDecision", { replace: choosing.replace })}
                  >
                    <span className="follow-up-candidate-title">직접 쓸래요</span>
                  </button>
                </li>
              </ul>
            </>
          )}
          {opening ? openingLabel : null}
          {error ? <p className="inline-error" role="alert">{error}</p> : null}
          <button className="follow-up-cancel" type="button" onClick={onCancel}>그만두기</button>
        </>
      ) : (
        <>
          <p className="follow-up-more-head">더 쓸 자리</p>
          <div className="follow-up-more-actions">
            {actions.map(({ project, slot, replace }) => {
              const busyHere = opening === `${project.name} ${slot}`;
              return (
                <button
                  key={`${project.name} ${slot} ${replace}`}
                  type="button"
                  aria-disabled={busy}
                  onClick={() => (slot === "keyDecision"
                    ? onChoose(project, replace)
                    : onOpen(project, slot))}
                >
                  {busyHere
                    ? openingLabel
                    : <>{project.title} · {replace ? "다른 결정으로" : SLOT_LABEL[slot]}</>}
                </button>
              );
            })}
          </div>
          {error ? <p className="inline-error" role="alert">{error}</p> : null}
        </>
      )}
    </aside>
  );
}
