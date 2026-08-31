/**
 * 날짜 표기를 한곳에 모은다. 화면마다 따로 만들어 쓰던 포맷터가 일곱 개였고
 * 옵션 조합도 제각각이라 같은 값이 화면마다 다르게 보였다.
 */

const dayFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

const longDayFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

/** 목록과 카드처럼 좁은 자리. 예: 2026. 8. 31. */
export function formatDay(value: string): string {
  return dayFormatter.format(new Date(value));
}

/** 문장 안에 들어가는 자리. 예: 2026년 8월 31일 */
export function formatLongDay(value: string): string {
  return longDayFormatter.format(new Date(value));
}
