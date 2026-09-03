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
