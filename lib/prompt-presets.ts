/**
 * 프롬프트를 고르는 선택지.
 *
 * 백지에 "무엇을 강조할지 적어주세요"라고 두면 대부분 아무것도 못 적거나
 * "잘 써주세요"라고 적는다. 예문을 보여주는 것으로도 부족했다 — 읽고 나서
 * 여전히 자기 손으로 옮겨 적어야 하기 때문이다.
 *
 * 고르면 문장이 만들어지고, 그 문장을 그대로 고치거나 지우고 새로 쓸 수 있다.
 * 시작점을 주되 가두지 않는다.
 *
 * 여섯 개가 공통으로 말하는 것은 **무엇을 앞에 둘지**다. 이 칸이 실제로
 * 정하는 것이 그것이기 때문이다. 사실은 저장소 근거와 되묻기가 담는다.
 */

export type PromptDirection = {
  id: string;
  /** 체크박스에 붙는 짧은 이름. */
  label: string;
  /** 무엇이 달라지는지 한 줄. 고르기 전에 알아야 고를 수 있다. */
  hint: string;
  /** 조립될 문장. 사용자가 AI에게 하는 말이라 사용자의 말투로 쓴다. */
  sentence: string;
};

export const PROMPT_DIRECTIONS: PromptDirection[] = [
  {
    id: "target-role",
    label: "지원 직무와 연결해서",
    hint: "직무에 닿는 경험이 앞으로",
    sentence: "지원하는 직무와 이어지는 경험을 앞에 놓아주세요. 직무와 거리가 먼 작업은 짧게만 언급해주세요.",
  },
  {
    id: "own-scope",
    label: "팀 작업과 내 몫 구분",
    hint: "내가 맡은 범위가 먼저",
    sentence: "팀 프로젝트는 팀이 한 일과 제가 한 일이 섞이지 않게 써주세요. 제가 맡은 범위가 먼저 보이면 좋겠어요.",
  },
  {
    id: "honest-scale",
    label: "규모를 부풀리지 않기",
    hint: "작으면 작은 대로, 대신 결정한 범위가 보이게",
    sentence: "프로젝트 규모를 부풀리지 말아주세요. 작으면 작은 대로 쓰되, 어디까지 제가 직접 정하고 만들었는지가 보이게 해주세요.",
  },
  {
    id: "why-over-what",
    label: "문제 해결 과정 중심",
    hint: "무엇을 만들었는지보다 왜 그렇게 만들었는지",
    sentence: "무엇을 만들었는지보다 왜 그렇게 만들었는지가 드러나게 써주세요. 고민했던 지점과 그 방법을 고른 이유를 앞에 놓아주세요.",
  },
  {
    id: "depth",
    label: "기술 깊이 우선",
    hint: "넓게 나열하는 대신 깊게 다룬 것을",
    sentence: "여러 기술을 넓게 나열하지 말고, 깊게 다뤄본 것 위주로 써주세요.",
  },
  {
    id: "recent",
    label: "최근 작업 위주",
    hint: "오래된 것보다 최근 것을 앞에",
    sentence: "오래된 작업보다 최근에 한 작업을 앞에 놓아주세요.",
  },
];

/**
 * 고른 것을 문장으로 잇는다.
 *
 * 순서는 고른 순서가 아니라 목록 순서다. 같은 조합이면 언제나 같은 문장이
 * 나와야, 체크를 껐다 켜도 글이 뒤섞이지 않는다.
 */
export function composePrompt(selected: readonly string[]): string {
  return PROMPT_DIRECTIONS
    .filter((direction) => selected.includes(direction.id))
    .map((direction) => direction.sentence)
    .join(" ");
}
