import { decryptSecret } from "@/server/auth/crypto";
import { TIMEOUTS, fetchWithTimeout } from "@/server/net/fetch";
import { getRepository } from "@/server/github/repositories";
import type {
  PortfolioEvidence,
  PortfolioEvidenceRepository,
  PortfolioTone,
} from "@/server/openai/portfolio-prompt";
import { getSupabaseClient } from "@/server/supabase/client";

// 저장소가 늘어나면 README를 그대로 이어붙일 때 AI 입력이 급격히 커진다.
const MAX_README_LENGTH_SINGLE = 6000;
const MAX_README_LENGTH_MULTI = 4500;
const MAX_ACTIVITY_ITEMS = 20;

/* 근거를 본인 것과 팀 것으로 나누려면 GitHub 로그인 이름이 필요하다.
   users.username이 연동할 때 저장한 GitHub login이다. */
async function getGitHubIdentity(userId: string): Promise<{ accessToken: string; login: string }> {
  const supabase = getSupabaseClient();
  const [connection, user] = await Promise.all([
    supabase.from("github_connections")
      .select("access_token_ciphertext, access_token_iv").eq("user_id", userId).maybeSingle(),
    supabase.from("users").select("username").eq("id", userId).maybeSingle(),
  ]);
  if (connection.error || !connection.data) throw new Error("GitHub connection is unavailable.");
  return {
    accessToken: await decryptSecret(
      connection.data.access_token_ciphertext,
      connection.data.access_token_iv,
    ),
    login: (user.data?.username as string | undefined) ?? "",
  };
}

/* 커밋 저자가 GitHub 계정에 연결돼 있지 않으면 author가 비어 온다. 그때는
   본인 것으로 보지 않는다. 남의 작업을 성과로 삼는 쪽이 더 큰 사고다. */
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
  if (!response.ok && response.status !== 404) throw new Error("GitHub evidence lookup failed.");
  return response;
}

async function collectRepositoryEvidence(
  userId: string,
  repositoryId: string,
  accessToken: string,
  login: string,
  maxReadmeLength: number,
): Promise<PortfolioEvidenceRepository> {
  const repository = await getRepository(userId, repositoryId);
  if (!repository) throw new Error("Repository is unavailable.");
  const [readmeResponse, languagesResponse, commitsResponse, pullsResponse] = await Promise.all([
    requestGitHub(accessToken, `/repos/${repository.fullName}/readme`, "application/vnd.github.raw+json"),
    requestGitHub(accessToken, `/repos/${repository.fullName}/languages`),
    requestGitHub(accessToken, `/repos/${repository.fullName}/commits?per_page=${MAX_ACTIVITY_ITEMS}`),
    requestGitHub(accessToken, `/repos/${repository.fullName}/pulls?state=all&sort=updated&direction=desc&per_page=${MAX_ACTIVITY_ITEMS}`),
  ]);
  const readme = readmeResponse.ok ? (await readmeResponse.text()).slice(0, maxReadmeLength) : "";
  const languageBytes = languagesResponse.ok ? await languagesResponse.json() as Record<string, number> : {};
  const totalBytes = Object.values(languageBytes).reduce((total, bytes) => total + bytes, 0);
  const languages = Object.entries(languageBytes).map(([name, bytes]) => ({ name, percentage: totalBytes ? Number(((bytes / totalBytes) * 100).toFixed(1)) : 0 }));
  const commits = commitsResponse.ok
    ? await commitsResponse.json() as Array<{ commit?: { message?: string }; author?: { login?: string } | null }>
    : [];
  const pulls = pullsResponse.ok
    ? await pullsResponse.json() as Array<{ title?: string; user?: { login?: string } | null }>
    : [];
  const commitTitles = commits.map((commit) => ({
    title: titleOf(commit.commit?.message),
    own: isOwnLogin(login, commit.author?.login),
  })).filter((commit) => commit.title);
  const pullTitles = pulls.map((pull) => ({
    title: pull.title || "",
    own: isOwnLogin(login, pull.user?.login),
  })).filter((pull) => pull.title);
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
    ownCommitTitles: commitTitles.filter((commit) => commit.own).map((commit) => commit.title).slice(0, MAX_ACTIVITY_ITEMS),
    teamCommitTitles: commitTitles.filter((commit) => !commit.own).map((commit) => commit.title).slice(0, MAX_ACTIVITY_ITEMS),
    ownPullRequestTitles: pullTitles.filter((pull) => pull.own).map((pull) => pull.title).slice(0, MAX_ACTIVITY_ITEMS),
    teamPullRequestTitles: pullTitles.filter((pull) => !pull.own).map((pull) => pull.title).slice(0, MAX_ACTIVITY_ITEMS),
  };
}

export async function collectPortfolioEvidence(
  userId: string,
  repositoryIds: string[],
  request: { prompt: string; targetRole?: string | null; tone?: PortfolioTone | null; highlights?: string[] },
): Promise<PortfolioEvidence> {
  if (repositoryIds.length === 0) throw new Error("At least one repository is required.");
  const { accessToken, login } = await getGitHubIdentity(userId);
  const maxReadmeLength = repositoryIds.length > 1 ? MAX_README_LENGTH_MULTI : MAX_README_LENGTH_SINGLE;

  // 선택 순서를 유지해야 프로젝트 순서와 대표 저장소가 맞는다.
  const repositories = await Promise.all(
    repositoryIds.map((repositoryId) =>
      collectRepositoryEvidence(userId, repositoryId, accessToken, login, maxReadmeLength)),
  );

  return {
    repositories,
    targetRole: request.targetRole || "개발자",
    tone: request.tone || "professional",
    prompt: request.prompt,
    highlights: request.highlights || [],
  };
}
