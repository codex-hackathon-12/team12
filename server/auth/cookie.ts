/**
 * 세션 쿠키 이름.
 *
 * 잎 모듈이다 — 아무것도 import하지 않는다. 미들웨어(edge 번들)가 이 이름을
 * 봐야 하는데, 원래 자리인 session.ts는 supabase 클라이언트를 끌고 와서
 * 미들웨어가 import할 수 없다. 이름을 두 곳에 적으면 쿠키 이름을 바꿀 때
 * 가드만 조용히 죽으므로, 여기가 단일 출처다.
 */
export const SESSION_COOKIE_NAME = "portfolio_session";
