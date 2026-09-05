/**
 * 근거를 읽어내는 순수 함수들.
 *
 * 수집 본체(`evidence.ts`)는 GitHub과 Supabase에 물려 있어 단위 테스트로
 * 부를 수 없다. 판단이 갈리는 부분만 여기로 떼어내 따로 검증한다. 특히 본인
 * 판정은 틀리는 방향이 중요하다 — 못 찾으면 근거가 얇아질 뿐이지만, 잘못
 * 찾으면 남의 작업이 지원자의 성과가 된다.
 */

/**
 * GitHub 계정에 연결되지 않은 커밋의 저자를 이메일로 판정한다.
 *
 * git이 쓴 이메일이 GitHub에 등록돼 있지 않으면 커밋의 author가 비어 오고,
 * 그러면 본인 커밋을 하나도 못 찾는다. 실제로 흔한 상황인데 결과는 심각하다 —
 * 혼자 만든 저장소가 남의 프로젝트처럼 서술된다.
 *
 * 다만 이름 비교는 하지 않는다. 흔한 이름이 겹치면 남의 작업을 성과로 삼게
 * 되고, 그건 근거가 없는 것보다 나쁘다. 본인임이 확실한 두 가지만 본다:
 * GitHub 프로필에 등록된 대표 이메일과, GitHub이 발급하는 noreply 주소다.
 */
export function isOwnEmail(login: string, email: string, candidate: string | null | undefined): boolean {
  const value = candidate?.trim().toLowerCase();
  if (!value) return false;
  if (email && value === email.trim().toLowerCase()) return true;
  // 12345+octocat@users.noreply.github.com / octocat@users.noreply.github.com
  return Boolean(login) && new RegExp(
    `^(?:\\d+\\+)?${login.toLowerCase().replace(/[.*+?^$@{}()|[\]\\-]/gu, "\\$&")}@users\\.noreply\\.github\\.com$`,
    "u",
  ).test(value);
}

/** 제목 다음 줄부터가 본문이다. 빈 줄과 자동 생성 꼬리표는 걷어낸다. */
export function bodyOf(message: string | undefined): string {
  const lines = (message ?? "").split("\n").slice(1);
  return lines
    .filter((line) => !/^(?:Co-authored-by|Signed-off-by):/iu.test(line.trim()))
    .join("\n")
    .trim();
}

export function parseManifest(path: string, text: string): string[] {
  if (path === "package.json") {
    try {
      const parsed = JSON.parse(text) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      return [...Object.keys(parsed.dependencies ?? {}), ...Object.keys(parsed.devDependencies ?? {})];
    } catch {
      // 주석이 섞였거나 깨진 파일. 근거가 없는 것으로 두는 편이 낫다.
      return [];
    }
  }
  // requirements.txt — 주석과 옵션 줄을 걷고 버전 지정자 앞까지만.
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && !line.startsWith("-"))
    .map((line) => line.split(/[<>=!~;[\s]/u)[0])
    .filter(Boolean);
}

/**
 * diff에서 볼 가치가 없는 파일을 걸러낸다.
 *
 * 잠금 파일 하나가 수천 줄이라 그대로 실으면 근거 예산을 통째로 먹고, 정작
 * 본인이 쓴 코드는 밀려난다. 빌드 산출물과 압축본도 사람이 쓴 것이 아니라
 * "무엇을 어떻게 짰는지"를 말해주지 않는다.
 */
export function isNoisyPath(path: string): boolean {
  return /(?:^|\/)(?:package-lock\.json|yarn\.lock|pnpm-lock\.yaml|poetry\.lock|Cargo\.lock|go\.sum|composer\.lock)$/u.test(path)
    || /(?:^|\/)(?:dist|build|out|vendor|node_modules|__snapshots__)\//u.test(path)
    || /\.(?:min\.(?:js|css)|map|snap|svg|png|jpe?g|gif|webp|ico|woff2?|ttf|pdf)$/iu.test(path);
}

/**
 * 기여 기간을 사람이 읽는 한 줄로 만든다.
 *
 * 면접관이 프로젝트에서 가장 먼저 찾는 맥락이 "언제, 얼마나"다. 값은 커밋
 * 날짜라 관찰된 사실이고, 모델을 거치지 않으므로 지어낼 여지가 없다.
 */
export function formatPeriod(first: string | null, last: string | null): string | null {
  const start = first ? new Date(first) : null;
  const end = last ? new Date(last) : null;
  if (!start || Number.isNaN(start.getTime())) return null;

  const label = (date: Date) => `${date.getUTCFullYear()}.${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  const from = label(start);
  if (!end || Number.isNaN(end.getTime())) return from;

  const to = label(end);
  if (from === to) return from;
  // 같은 해면 뒤쪽 연도를 생략한다. "2026.03–06"이 "2026.03–2026.06"보다 읽기 쉽다.
  return start.getUTCFullYear() === end.getUTCFullYear()
    ? `${from}–${to.slice(5)}`
    : `${from}–${to}`;
}

/**
 * 페이지네이션 헤더에서 마지막 페이지 번호를 읽는다.
 *
 * 최초 커밋을 알려면 마지막 페이지가 필요하다. 커밋이 한 페이지에 다 들어가면
 * 이 헤더 자체가 없고, 그때는 이미 손에 있는 목록의 끝이 최초 커밋이다.
 */
export function lastPageOf(linkHeader: string | null): number | null {
  const match = linkHeader?.match(/[?&]page=(\d+)[^>]*>;\s*rel="last"/u);
  const page = match ? Number(match[1]) : NaN;
  return Number.isInteger(page) && page > 1 ? page : null;
}
