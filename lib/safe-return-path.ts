/**
 * 로그인 뒤 돌아갈 경로인지 확인한다.
 *
 * 상대 경로만 허용한다. 절대 URL이나 `//host` 꼴을 통과시키면 로그인 흐름이
 * 열린 리다이렉트가 된다 — 피싱 사이트가 returnTo에 자기 주소를 실어 보낼 수 있다.
 *
 * 잎 모듈이다. 서버 라우트(콜백)와 랜딩 화면이 같은 판정을 써야 한 쪽만
 * 느슨해지는 일이 없다.
 */
export function isSafeReturnPath(value: string | null): value is string {
  if (!value || !value.startsWith("/")) {
    return false;
  }
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/u.test(value)) {
    return false;
  }
  return !/^\/[/\\]/u.test(value);
}
