import { getUsableAccessToken } from "@/server/auth/github-token";
import { TIMEOUTS, fetchWithTimeout } from "@/server/net/fetch";
import { getRepository, toGitHubApiError } from "@/server/github/repositories";
import type {
  PortfolioEvidence,
  PortfolioEvidenceRepository,
  PortfolioTone,
} from "@/server/openai/portfolio-prompt";
import { bodyOf, isOwnEmail, parseManifest } from "@/server/github/evidence-parsing";
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

async function collectRepositoryEvidence(
  userId: string,
  repositoryId: string,
  accessToken: string,
  login: string,
  email: string,
  maxReadmeLength: number,
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
        commit?: { message?: string; author?: { email?: string } | null };
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
  const commitEntries = commits.map((commit) => ({
    title: titleOf(commit.commit?.message),
    body: bodyOf(commit.commit?.message),
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

  // 선택 순서를 유지해야 프로젝트 순서와 대표 저장소가 맞는다.
  const repositories = await Promise.all(
    repositoryIds.map((repositoryId) =>
      collectRepositoryEvidence(userId, repositoryId, accessToken, login, email, maxReadmeLength)),
  );

  return {
    repositories,
    targetRole: request.targetRole || "개발자",
    tone: request.tone || "professional",
    prompt: request.prompt,
    highlights: request.highlights || [],
  };
}
