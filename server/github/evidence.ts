import { getUsableAccessToken } from "@/server/auth/github-token";
import { TIMEOUTS, fetchWithTimeout } from "@/server/net/fetch";
import { getRepository, toGitHubApiError } from "@/server/github/repositories";
import type {
  PortfolioEvidence,
  PortfolioEvidenceRepository,
  PortfolioTone,
} from "@/server/openai/portfolio-prompt";
import {
  bodyOf,
  formatPeriod,
  isNoisyPath,
  isOwnEmail,
  lastPageOf,
  parseManifest,
} from "@/server/github/evidence-parsing";
import { getSupabaseClient } from "@/server/supabase/client";

// 저장소가 늘어나면 README를 그대로 이어붙일 때 AI 입력이 급격히 커진다.
const MAX_README_LENGTH_SINGLE = 6000;
const MAX_README_LENGTH_MULTI = 4500;
const MAX_ACTIVITY_ITEMS = 20;
// PR 본문은 근거로서 가치가 크지만 길이는 제각각이라 상한을 둔다.
const MAX_PULL_BODIES = 5;
const MAX_PULL_BODY_LENGTH = 400;
/* 커밋 본문은 "왜 그렇게 했는지"가 적히는 자리다. 다만 전부 실으면 근거보다
   잡음이 커지므로 PR 본문과 같은 방식으로 최근 몇 건만 싣는다. */
const MAX_COMMIT_BODIES = 6;
const MAX_COMMIT_BODY_LENGTH = 300;
const MAX_TOP_LEVEL_PATHS = 40;
const MAX_CONTRIBUTORS = 10;

/**
 * 본인 커밋의 실제 변경 내용.
 *
 * 지금까지 근거는 제목과 본문, 즉 "무엇을 했다고 말했는지"였다. 무엇을 실제로
 * 짰는지는 한 줄도 읽지 않았다. 그래서 질문이 "이 프로젝트로 무엇이
 * 달라졌나요?"처럼 저장소를 안 봐도 물을 수 있는 것만 나왔다.
 *
 * diff를 읽으면 "재시도를 고정 간격으로 둔 이유가 있나요?"를 물을 수 있다.
 * 파일 전체가 아니라 diff인 이유는, 그것이 정확히 **본인이 바꾼 부분**이기
 * 때문이다. 파일을 통째로 읽으면 남이 쓴 코드가 섞이고 입력만 커진다.
 *
 * 예산은 README와 같은 방식으로 저장소 수에 따라 갈린다.
 */
const MAX_DIFF_COMMITS_SINGLE = 3;
const MAX_DIFF_COMMITS_MULTI = 2;
const MAX_DIFF_FILES = 5;
const MAX_PATCH_LENGTH = 800;
const MAX_COMMIT_PATCH_TOTAL = 2500;

/* 근거를 본인 것과 팀 것으로 나누려면 GitHub 로그인 이름이 필요하다.
   users.username이 연동할 때 저장한 GitHub login이다. */
async function getGitHubIdentity(
  userId: string,
): Promise<{ accessToken: string; login: string; email: string }> {
  const [accessToken, user] = await Promise.all([
    // 만료가 임박하면 여기서 갱신된 토큰을 받는다.
    getUsableAccessToken(userId),
    getSupabaseClient().from("users").select("username, email").eq("id", userId).maybeSingle(),
  ]);
  return {
    accessToken,
    login: (user.data?.username as string | undefined) ?? "",
    email: (user.data?.email as string | undefined) ?? "",
  };
}

function isOwnLogin(login: string, candidate: string | null | undefined): boolean {
  return Boolean(login) && Boolean(candidate) && candidate!.toLowerCase() === login.toLowerCase();
}


function titleOf(message: string | undefined): string {
  return message?.split("\n")[0] ?? "";
}


async function requestGitHub(accessToken: string, path: string, accept = "application/vnd.github+json"): Promise<Response> {
  const response = await fetchWithTimeout(
    `https://api.github.com${path}`,
    { headers: { Authorization: `Bearer ${accessToken}`, Accept: accept, "User-Agent": "job-portfolio-ai" } },
    TIMEOUTS.github,
  );
  // 404는 README가 없는 저장소 등 정상 상황이라 그대로 흘려보낸다.
  if (!response.ok && response.status !== 404) {
    throw toGitHubApiError(response, "GitHub evidence lookup failed.");
  }
  return response;
}


/**
 * 의존성 목록을 읽는다.
 *
 * 지금까지 techStack의 근거는 언어 통계와 README 언급뿐이었다. 그런데 언어
 * 통계는 "TypeScript 78%"까지만 말하고 React인지 Vue인지는 말하지 않는다.
 * 채용 담당자가 보는 건 후자다.
 *
 * 최상위 트리를 이미 읽었으므로 거기 있는 것만 골라 요청한다. 없는 파일을
 * 찔러보지 않으니 대부분 저장소에서 추가 호출은 한 번이다.
 */
const MANIFESTS = ["package.json", "requirements.txt"] as const;
const MAX_MANIFESTS = 2;
const MAX_DEPENDENCIES = 40;


async function collectDependencies(
  accessToken: string,
  fullName: string,
  topLevelPaths: string[],
): Promise<string[]> {
  const present = MANIFESTS.filter((name) => topLevelPaths.includes(name)).slice(0, MAX_MANIFESTS);
  if (present.length === 0) return [];

  const files = await Promise.all(
    present.map(async (name) => {
      const response = await requestGitHub(
        accessToken,
        `/repos/${fullName}/contents/${name}`,
        "application/vnd.github.raw+json",
      );
      return response.ok ? { name, text: await response.text() } : null;
    }),
  );

  const names = files
    .filter((file) => file !== null)
    .flatMap((file) => parseManifest(file.name, file.text));
  return [...new Set(names)].slice(0, MAX_DEPENDENCIES);
}

type CommitEntry = { sha: string; title: string; body: string; date: string; own: boolean };

/**
 * 어떤 커밋의 diff를 볼지 고른다.
 *
 * 본문이 있는 커밋을 먼저 본다. 본문을 쓴 커밋은 그만큼 설명할 것이 있었던
 * 변경이고, 이유가 적힌 자리와 실제 코드를 나란히 놓으면 근거가 가장 두꺼워진다.
 */
function pickDiffCommits(entries: CommitEntry[], budget: number): CommitEntry[] {
  const withBody = entries.filter((commit) => commit.body);
  const rest = entries.filter((commit) => !commit.body);
  return [...withBody, ...rest].slice(0, budget);
}

async function collectCommitDiff(
  accessToken: string,
  fullName: string,
  commit: CommitEntry,
): Promise<{ title: string; files: Array<{ path: string; patch: string }> }> {
  const response = await requestGitHub(accessToken, `/repos/${fullName}/commits/${commit.sha}`);
  if (!response.ok) return { title: commit.title, files: [] };

  const detail = await response.json() as {
    files?: Array<{ filename?: string; patch?: string }>;
  };
  const files: Array<{ path: string; patch: string }> = [];
  let used = 0;
  for (const file of detail.files ?? []) {
    if (files.length >= MAX_DIFF_FILES || used >= MAX_COMMIT_PATCH_TOTAL) break;
    const path = file.filename ?? "";
    // patch가 없는 것은 바이너리이거나 GitHub이 너무 크다고 판단한 파일이다.
    if (!path || !file.patch || isNoisyPath(path)) continue;
    const patch = file.patch.slice(0, Math.min(MAX_PATCH_LENGTH, MAX_COMMIT_PATCH_TOTAL - used));
    files.push({ path, patch });
    used += patch.length;
  }
  return { title: commit.title, files };
}

type DatedCommit = { commit?: { author?: { date?: string } | null } };

/**
 * 본인 첫 커밋 시각을 찾는다. 기여 기간의 시작점이다.
 *
 * 목록은 최신순이라 손에 있는 것은 최근 커밋뿐이다. 커밋이 한 페이지에 다
 * 들어가는 저장소는 이미 받은 본인 커밋의 끝이 곧 첫 커밋이다.
 *
 * 더 큰 저장소에서는 author 필터로 좁혀 다시 묻는다. 예전에는 저장소 전체의
 * 마지막 페이지를 받아 그 끝 커밋의 날짜를 썼는데, 팀 저장소에서는 그게
 * 남이 시작한 날짜다 — "본인 기여 기간"의 시작으로 남의 첫 커밋이 문서에
 * 박히고 있었다. per_page=1이면 rel=last의 페이지 번호가 곧 본인 커밋
 * 총수이므로, 그 페이지 하나를 더 받으면 본인 첫 커밋이 나온다.
 *
 * author 필터는 GitHub 계정에 연결된 커밋만 잡는다. 이메일로만 매칭된
 * 커밋(연결 안 된 주소)은 필터에 안 걸리므로, 못 찾으면 손에 있는 본인
 * 커밋의 끝으로 물러선다 — 기간이 짧게 잡힐지언정 남의 날짜는 아니다.
 */
async function findFirstOwnCommitDate(
  accessToken: string,
  fullName: string,
  login: string,
  linkHeader: string | null,
  loadedOwn: CommitEntry[],
): Promise<string | null> {
  const fallback = loadedOwn.at(-1)?.date ?? null;
  if (!lastPageOf(linkHeader) || !login) return fallback;

  const author = encodeURIComponent(login);
  const probe = await requestGitHub(accessToken, `/repos/${fullName}/commits?author=${author}&per_page=1`);
  if (!probe.ok) return fallback;

  const total = lastPageOf(probe.headers.get("link"));
  if (!total) {
    // 본인 커밋이 1개뿐이거나 author 필터에 하나도 안 걸린 경우.
    // probe 응답이 그 1개일 수 있으니 먼저 읽어 본다.
    const single = await probe.json() as DatedCommit[];
    return single.at(-1)?.commit?.author?.date ?? fallback;
  }

  const response = await requestGitHub(
    accessToken,
    `/repos/${fullName}/commits?author=${author}&per_page=1&page=${total}`,
  );
  if (!response.ok) return fallback;
  const commits = await response.json() as DatedCommit[];
  return commits.at(-1)?.commit?.author?.date ?? fallback;
}

async function collectRepositoryEvidence(
  userId: string,
  repositoryId: string,
  accessToken: string,
  login: string,
  email: string,
  maxReadmeLength: number,
  maxDiffCommits: number,
): Promise<PortfolioEvidenceRepository> {
  const repository = await getRepository(userId, repositoryId);
  if (!repository) throw new Error("Repository is unavailable.");
  const [
    readmeResponse,
    languagesResponse,
    commitsResponse,
    pullsResponse,
    treeResponse,
    workflowsResponse,
    contributorsResponse,
  ] = await Promise.all([
    requestGitHub(accessToken, `/repos/${repository.fullName}/readme`, "application/vnd.github.raw+json"),
    requestGitHub(accessToken, `/repos/${repository.fullName}/languages`),
    requestGitHub(accessToken, `/repos/${repository.fullName}/commits?per_page=${MAX_ACTIVITY_ITEMS}`),
    requestGitHub(accessToken, `/repos/${repository.fullName}/pulls?state=all&sort=updated&direction=desc&per_page=${MAX_ACTIVITY_ITEMS}`),
    // 재귀 없이 최상위만 읽는다. 큰 저장소에서 전체 트리는 응답이 지나치게 커진다.
    requestGitHub(accessToken, `/repos/${repository.fullName}/git/trees/${repository.defaultBranch}`),
    requestGitHub(accessToken, `/repos/${repository.fullName}/actions/workflows`),
    requestGitHub(accessToken, `/repos/${repository.fullName}/contributors?per_page=${MAX_CONTRIBUTORS}`),
  ]);
  const readme = readmeResponse.ok ? (await readmeResponse.text()).slice(0, maxReadmeLength) : "";
  const languageBytes = languagesResponse.ok ? await languagesResponse.json() as Record<string, number> : {};
  const totalBytes = Object.values(languageBytes).reduce((total, bytes) => total + bytes, 0);
  const languages = Object.entries(languageBytes).map(([name, bytes]) => ({ name, percentage: totalBytes ? Number(((bytes / totalBytes) * 100).toFixed(1)) : 0 }));
  const commits = commitsResponse.ok
    ? await commitsResponse.json() as Array<{
        sha?: string;
        commit?: { message?: string; author?: { email?: string; date?: string } | null };
        author?: { login?: string } | null;
      }>
    : [];
  const pulls = pullsResponse.ok
    ? await pullsResponse.json() as Array<{
        title?: string;
        body?: string | null;
        merged_at?: string | null;
        user?: { login?: string } | null;
      }>
    : [];
  const tree = treeResponse.ok
    ? await treeResponse.json() as { tree?: Array<{ path?: string; type?: string }> }
    : {};
  const workflows = workflowsResponse.ok
    ? await workflowsResponse.json() as { total_count?: number }
    : {};
  const contributors = contributorsResponse.ok
    ? await contributorsResponse.json() as Array<unknown>
    : [];
  const commitEntries: CommitEntry[] = commits.map((commit) => ({
    sha: commit.sha ?? "",
    title: titleOf(commit.commit?.message),
    body: bodyOf(commit.commit?.message),
    date: commit.commit?.author?.date ?? "",
    /* author가 있으면 그걸 믿고, 없을 때만 이메일로 확인한다. */
    own: commit.author
      ? isOwnLogin(login, commit.author.login)
      : isOwnEmail(login, email, commit.commit?.author?.email),
  })).filter((commit) => commit.title);
  const ownCommitEntries = commitEntries.filter((commit) => commit.own);
  const pullEntries = pulls.map((pull) => ({
    title: pull.title || "",
    own: isOwnLogin(login, pull.user?.login),
    merged: Boolean(pull.merged_at),
    body: (pull.body ?? "").trim(),
  })).filter((pull) => pull.title);
  const ownPulls = pullEntries.filter((pull) => pull.own).slice(0, MAX_ACTIVITY_ITEMS);
  const topLevelPaths = (tree.tree ?? [])
    .map((entry) => (entry.type === "tree" ? `${entry.path}/` : entry.path ?? ""))
    .filter(Boolean)
    .slice(0, MAX_TOP_LEVEL_PATHS);
  /* 트리를 받은 뒤에야 어떤 매니페스트가 있는지 알 수 있어 여기서 한 번 더 부른다. */
  const dependencies = await collectDependencies(accessToken, repository.fullName, topLevelPaths);

  /* diff와 최초 커밋은 목록을 받은 뒤에야 대상을 정할 수 있다. 둘은 서로
     독립이라 함께 기다린다. 본인 커밋이 하나도 없으면 diff도 기간도 없다. */
  const [ownCommitDiffs, firstCommitAt] = await Promise.all([
    Promise.all(
      pickDiffCommits(ownCommitEntries.filter((commit) => commit.sha), maxDiffCommits)
        .map((commit) => collectCommitDiff(accessToken, repository.fullName, commit)),
    ),
    ownCommitEntries.length > 0
      ? findFirstOwnCommitDate(
          accessToken,
          repository.fullName,
          login,
          commitsResponse.headers.get("link"),
          ownCommitEntries,
        )
      : Promise.resolve(null),
  ]);
  return {
    id: repository.id,
    name: repository.name,
    description: repository.description,
    url: repository.htmlUrl,
    primaryLanguage: repository.primaryLanguage,
    starCount: repository.starCount,
    forkCount: repository.forkCount,
    pushedAt: repository.pushedAt,
    languages,
    readme,
    ownCommits: ownCommitEntries.slice(0, MAX_ACTIVITY_ITEMS).map((commit, index) => ({
      title: commit.title,
      // 본문은 최근 몇 건만. PR 본문과 같은 방식이다.
      body: index < MAX_COMMIT_BODIES ? commit.body.slice(0, MAX_COMMIT_BODY_LENGTH) : "",
    })),
    /* 커밋은 있는데 본인 것이 하나도 없다 — 기여가 없는 게 아니라 확인이 안 된
       상태다. 모델이 둘을 구별할 수 있어야 한다. */
    ownContributionUnverifiable: commitEntries.length > 0 && ownCommitEntries.length === 0,
    /* 파일이 하나도 안 남은 커밋은 잠금 파일만 바꾼 것이라 근거가 아니다. */
    ownCommitDiffs: ownCommitDiffs.filter((diff) => diff.files.length > 0),
    contributionPeriod: formatPeriod(firstCommitAt, ownCommitEntries[0]?.date ?? null),
    teamCommitTitles: commitEntries.filter((commit) => !commit.own).map((commit) => commit.title).slice(0, MAX_ACTIVITY_ITEMS),
    // 본문은 최근 몇 건만 싣는다. 전부 실으면 입력이 근거보다 잡음으로 커진다.
    ownPullRequests: ownPulls.map((pull, index) => ({
      title: pull.title,
      merged: pull.merged,
      body: index < MAX_PULL_BODIES ? pull.body.slice(0, MAX_PULL_BODY_LENGTH) : "",
    })),
    teamPullRequestTitles: pullEntries.filter((pull) => !pull.own).map((pull) => pull.title).slice(0, MAX_ACTIVITY_ITEMS),
    topLevelPaths,
    dependencies,
    hasContinuousIntegration: (workflows.total_count ?? 0) > 0,
    contributorCount: contributors.length,
  };
}

export async function collectPortfolioEvidence(
  userId: string,
  repositoryIds: string[],
  request: { prompt: string; targetRole?: string | null; tone?: PortfolioTone | null; highlights?: string[] },
): Promise<PortfolioEvidence> {
  if (repositoryIds.length === 0) throw new Error("At least one repository is required.");
  const { accessToken, login, email } = await getGitHubIdentity(userId);
  const maxReadmeLength = repositoryIds.length > 1 ? MAX_README_LENGTH_MULTI : MAX_README_LENGTH_SINGLE;
  const maxDiffCommits = repositoryIds.length > 1 ? MAX_DIFF_COMMITS_MULTI : MAX_DIFF_COMMITS_SINGLE;

  // 선택 순서를 유지해야 프로젝트 순서와 대표 저장소가 맞는다.
  const repositories = await Promise.all(
    repositoryIds.map((repositoryId) =>
      collectRepositoryEvidence(userId, repositoryId, accessToken, login, email, maxReadmeLength, maxDiffCommits)),
  );

  return {
    repositories,
    targetRole: request.targetRole || "개발자",
    tone: request.tone || "professional",
    prompt: request.prompt,
    highlights: request.highlights || [],
  };
}
