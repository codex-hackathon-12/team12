import type { GitHubScopeDto } from "@/contracts/api-contract";

/**
 * 로그인에서 요청하는 스코프.
 *
 * 설명은 이미 있었지만 설정 화면에서만 보였다 — 권한을 이미 준 뒤다. 동의 전에
 * 무엇을 왜 요구하는지 읽을 수 있어야 하고, 그러려면 서버 전용 모듈 밖에 있어야
 * 한다. 랜딩과 설정이 같은 문장을 쓴다.
 *
 * 근거: NN/g — 권한 요청은 이유를 먼저 설명할 때 승인률이 크게 오른다.
 */
export const REQUESTED_SCOPES: Array<Omit<GitHubScopeDto, "granted">> = [
  {
    name: "read:user",
    label: "프로필 읽기",
    description: "이름과 아바타 등 공개 프로필을 읽어 포트폴리오 머리말에 써요.",
    required: true,
  },
  {
    name: "user:email",
    label: "이메일 읽기",
    description: "연락처로 쓸 대표 이메일을 읽어요.",
    required: false,
  },
  {
    name: "repo",
    label: "저장소 접근 (private 포함)",
    description: "저장소 목록과 커밋·PR 근거를 읽어요. 코드를 쓰거나 바꾸지 않아요.",
    required: true,
  },
  {
    name: "read:org",
    label: "조직 정보 읽기",
    description: "조직 소속 저장소를 목록에 함께 보여드려요.",
    required: false,
  },
];
