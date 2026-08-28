import { decryptSecret } from "@/server/auth/crypto";
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

async function getAccessToken(userId: string): Promise<string> {
  const { data, error } = await getSupabaseClient().from("github_connections")
    .select("access_token_ciphertext, access_token_iv").eq("user_id", userId).maybeSingle();
  if (error || !data) throw new Error("GitHub connection is unavailable.");
  return decryptSecret(data.access_token_ciphertext, data.access_token_iv);
}

async function requestGitHub(accessToken: string, path: string, accept = "application/vnd.github+json"): Promise<Response> {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: accept, "User-Agent": "job-portfolio-ai" },
  });
  if (!response.ok && response.status !== 404) throw new Error("GitHub evidence lookup failed.");
  return response;
}

async function collectRepositoryEvidence(
  userId: string,
  repositoryId: string,
  accessToken: string,
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
  const commits = commitsResponse.ok ? await commitsResponse.json() as Array<{ commit?: { message?: string } }> : [];
  const pulls = pullsResponse.ok ? await pullsResponse.json() as Array<{ title?: string }> : [];
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
    commitTitles: commits.map((commit) => commit.commit?.message?.split("\n")[0] || "").filter(Boolean).slice(0, MAX_ACTIVITY_ITEMS),
    pullRequestTitles: pulls.map((pull) => pull.title || "").filter(Boolean).slice(0, MAX_ACTIVITY_ITEMS),
  };
}

export async function collectPortfolioEvidence(
  userId: string,
  repositoryIds: string[],
  request: { prompt: string; targetRole?: string | null; tone?: PortfolioTone | null; highlights?: string[] },
): Promise<PortfolioEvidence> {
  if (repositoryIds.length === 0) throw new Error("At least one repository is required.");
  const accessToken = await getAccessToken(userId);
  const maxReadmeLength = repositoryIds.length > 1 ? MAX_README_LENGTH_MULTI : MAX_README_LENGTH_SINGLE;

  // 선택 순서를 유지해야 프로젝트 순서와 대표 저장소가 맞는다.
  const repositories = await Promise.all(
    repositoryIds.map((repositoryId) =>
      collectRepositoryEvidence(userId, repositoryId, accessToken, maxReadmeLength)),
  );

  return {
    repositories,
    targetRole: request.targetRole || "개발자",
    tone: request.tone || "professional",
    prompt: request.prompt,
    highlights: request.highlights || [],
  };
}
