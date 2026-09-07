"use client";

import type { PortfolioDecisionCandidateDto, PortfolioQuestionSlot } from "@/contracts/api-contract";
import type { RailProject } from "@/components/portfolio/FollowUpRail";
import { SteadyLabel } from "@/components/ui/SteadyLabel";

/**
 * 더 쓰기 탭 — 문서의 자리를 훑고 여는 곳.
 *
 * 처음에는 대화 카드 아래 조각 카드에 칩으로 붙어 있었다. 작고, 대화와
 * 겹치고, 후보에 담을 수 있는 정보가 없었다. 탭이 되면서 패널 전체를 쓴다 —
 * 프로젝트마다 자리의 상태가 보이고, 결정 후보는 주제·요약·근거 커밋까지
 * 함께 선다.
 *
 * 상태는 갖지 않는다. 자리를 여는 순간 대화의 질문 순서가 바뀌므로 대화와
 * 같은 상태를 봐야 하고, 그건 대화가 들고 있다.
 */

export type SlotState = "open" | "pending" | "filled" | "full";

export type ProjectPlace = {
  project: RailProject;
  /** 핵심 결정 자리. filled면 "다른 결정으로"가 열린다. */
  decision: Exclude<SlotState, "full">;
  highlights: { state: Exclude<SlotState, "filled">; count: number };
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

export function MoreToWrite({
  places,
  choosing,
  busy,
  opening,
  error,
  onChoose,
  onOpen,
  onCancelChoose,
  onGoChat,
}: {
  places: ProjectPlace[];
  /** 결정 후보를 고르는 중이면 그 대상. 고르는 동안 목록 대신 후보가 선다. */
  choosing: DecisionChoice | null;
  busy: boolean;
  /** 지금 여는 중인 자리("{저장소} {slot}"). 누른 것만 "여는 중"이 된다. */
  opening: string | null;
  /** 자리를 열다 난 오류. 행동한 화면 안에서 보여야 한다. */
  error: string | null;
  onChoose: (project: RailProject, replace: boolean) => void;
  onOpen: (project: RailProject, slot: PortfolioQuestionSlot, options?: { topic?: string; replace?: boolean }) => void;
  onCancelChoose: () => void;
  /** 대화가 물을 예정인 자리에서 "대화로" 가는 길. */
  onGoChat: () => void;
}) {
  if (choosing) {
    return (
      <div className="follow-up-write">
        <button className="follow-up-back" type="button" onClick={onCancelChoose}>
          ← 돌아가기
        </button>
        <p className="follow-up-write-title">{choosing.project.title}의 어느 결정을 쓸까요?</p>

        {choosing.candidates === null ? (
          <p className="follow-up-status">
            <span className="loading-mark-inline" aria-hidden="true" />
            {/* 첫 열람은 모델이 커밋을 주제로 묶는 동안 기다린다. 다음부터는
                캐시에서 바로 온다. */}
            저장소 기록을 주제로 묶는 중… 처음은 조금 걸려요.
          </p>
        ) : (
          <>
            {choosing.failed ? (
              <p className="follow-up-status">저장소 기록을 불러오지 못했어요. 직접 쓸 수는 있어요.</p>
            ) : null}
            <ul className="follow-up-candidates">
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
                    <span className="follow-up-candidate-title">
                      {candidate.topic}
                      {/* 제목 나열로 물러난 경우에만 출처를 단다. 분류된 주제는
                          아래 근거 커밋이 출처를 말한다. */}
                      {candidate.source !== "analysis" ? (
                        <em>{candidate.source === "pullRequest" ? "PR" : "커밋"}</em>
                      ) : null}
                    </span>
                    {candidate.summary ? <small>{candidate.summary}</small> : null}
                    {/* 이 주제를 뒷받침하는 커밋·PR 제목 그대로. 저장소에서
                        찾아볼 수 있는 실마리다. */}
                    {candidate.evidence.length > 0 ? (
                      <span className="follow-up-candidate-evidence">
                        {candidate.evidence.map((line) => <code key={line}>{line}</code>)}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
              {/* 후보가 없어도 막지 않는다. 후보가 나쁜 것과 결정을 못 쓰는
                  것은 다른 일이다. */}
              <li>
                <button
                  type="button"
                  aria-disabled={busy}
                  onClick={() => onOpen(choosing.project, "keyDecision", { replace: choosing.replace })}
                >
                  <span className="follow-up-candidate-title">직접 쓸래요</span>
                  <small>주제 없이 세 가지를 물어볼게요.</small>
                </button>
              </li>
            </ul>
          </>
        )}
        {opening ? (
          <p className="follow-up-status">
            <span className="loading-mark-inline" aria-hidden="true" />
            여는 중…
          </p>
        ) : null}
        {error ? <p className="inline-error" role="alert">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="follow-up-write">
      {/* 고르면 문서가 바로 바뀌는 게 아니다 — 질문 세 개에 답해야 쓰인다.
          그 간극을 여기서 미리 말해둔다. 말하지 않으면 "눌러도 달라지는 게
          없다"가 된다. */}
      <p className="follow-up-write-note">
        자리를 열면 대화에서 몇 가지를 물어봐요. 답이 모이면 문서가 바뀌어요.
      </p>

      {places.map(({ project, decision, highlights }) => (
        <section className="follow-up-place" key={project.name}>
          <h3>{project.title}</h3>

          <div className="follow-up-slot">
            <span className="follow-up-slot-name">핵심 결정</span>
            {decision === "pending" ? (
              <>
                <span className="follow-up-slot-state">대화에서 답을 기다려요</span>
                <button type="button" onClick={onGoChat}>대화로</button>
              </>
            ) : decision === "filled" ? (
              <>
                <span className="follow-up-slot-state">쓰여 있어요</span>
                <button type="button" aria-disabled={busy} onClick={() => onChoose(project, true)}>
                  다른 결정으로
                </button>
              </>
            ) : (
              <>
                <span className="follow-up-slot-state">비어 있어요</span>
                <button type="button" aria-disabled={busy} onClick={() => onChoose(project, false)}>
                  주제 고르기
                </button>
              </>
            )}
          </div>

          <div className="follow-up-slot">
            <span className="follow-up-slot-name">강조</span>
            {highlights.state === "pending" ? (
              <>
                <span className="follow-up-slot-state">대화에서 답을 기다려요</span>
                <button type="button" onClick={onGoChat}>대화로</button>
              </>
            ) : highlights.state === "full" ? (
              <span className="follow-up-slot-state">다 찼어요</span>
            ) : (
              <>
                <span className="follow-up-slot-state">{highlights.count}개 쓰여 있어요</span>
                <button
                  type="button"
                  aria-disabled={busy}
                  onClick={() => onOpen(project, "highlights")}
                >
                  {/* 문구가 바뀌어도 폭이 흔들리지 않게 예약한다. */}
                  <SteadyLabel
                    states={["더 쓰기", "여는 중…"]}
                    value={opening === `${project.name} highlights` ? "여는 중…" : "더 쓰기"}
                  />
                </button>
              </>
            )}
          </div>
        </section>
      ))}

      {error ? <p className="inline-error" role="alert">{error}</p> : null}
    </div>
  );
}
