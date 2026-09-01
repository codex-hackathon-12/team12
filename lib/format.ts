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

/**
 * 조밀한 목록의 좁은 칸에 들어가는 날짜. 예: 26.08.30
 *
 * 한 줄 목록에서는 날짜 칸이 66px밖에 안 된다. 연도를 버리면 오래된 저장소와
 * 최근 저장소가 같아 보이므로 두 자리로 남긴다.
 */
export function formatListDay(value: string): string {
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${pad(date.getFullYear() % 100)}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
}
