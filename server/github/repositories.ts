import { decryptSecret } from "@/server/auth/crypto";
import { getSupabaseClient } from "@/server/supabase/client";

type GitHubRepository = {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  default_branch: string;
  language: string | null;
  private: boolean;
  stargazers_count: number;
  forks_count: number;
  pushed_at: string | null;
  updated_at: string;
  owner: {
    login: string;
    avatar_url: string;
  };
};

export type RepositoryDto = {
  id: string;
  githubRepositoryId: string;
  owner: { username: string; avatarUrl: string };
  name: string;
  fullName: string;
  description: string | null;
  htmlUrl: string;
  defaultBranch: string;
  primaryLanguage: string | null;
  visibility: "public" | "private";
  starCount: number;
  forkCount: number;
  pushedAt: string;
  syncedAt: string;
};

type RepositoryRecord = {
  id: string;
  github_repository_id: number;
  owner_username: string;
  owner_avatar_url: string;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  default_branch: string;
  primary_language: string | null;
  visibility: "public" | "private";
  star_count: number;
  fork_count: number;
  pushed_at: string;
  synced_at: string;
};

export class GitHubApiError extends Error {
  constructor(
    public readonly kind: "connection" | "rate_limited",
    message: string,
  ) {
    super(message);
  }
}

export class RepositoryLookupError extends Error {
  constructor(
    public readonly repositoryId: string,
    public readonly providerCode?: string,
  ) {
    super(
      `Repository lookup failed for ${repositoryId}${providerCode ? ` (code: ${providerCode})` : ""}.`,
    );
    this.name = "RepositoryLookupError";
  }
}

function mapRepository(record: RepositoryRecord): RepositoryDto {
  return {
    id: record.id,
    githubRepositoryId: String(record.github_repository_id),
    owner: { username: record.owner_username, avatarUrl: record.owner_avatar_url },
    name: record.name,
    fullName: record.full_name,
    description: record.description,
    htmlUrl: record.html_url,
    defaultBranch: record.default_branch,
    primaryLanguage: record.primary_language,
    visibility: record.visibility,
    starCount: record.star_count,
    forkCount: record.fork_count,
    pushedAt: record.pushed_at,
    syncedAt: record.synced_at,
  };
}

async function getAccessToken(userId: string): Promise<string> {
  const { data, error } = await getSupabaseClient()
    .from("github_connections")
    .select("access_token_ciphertext, access_token_iv")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    throw new GitHubApiError("connection", "GitHub account is not connected.");
  }

  return decryptSecret(data.access_token_ciphertext, data.access_token_iv);
}

async function requestGitHubRepositories(accessToken: string): Promise<GitHubRepository[]> {
  const repositories: GitHubRepository[] = [];
  for (let page = 1; page <= 10; page += 1) {
    const url = new URL("https://api.github.com/user/repos");
    url.searchParams.set("affiliation", "owner,collaborator,organization_member");
    url.searchParams.set("sort", "updated");
    url.searchParams.set("direction", "desc");
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));

    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "job-portfolio-ai",
      },
    });

    if (!response.ok) {
      if (response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0") {
        throw new GitHubApiError("rate_limited", "GitHub API rate limit was reached.");
      }
      throw new GitHubApiError("connection", "GitHub repositories could not be loaded.");
    }

    const pageItems = (await response.json()) as GitHubRepository[];
    repositories.push(...pageItems);
    if (pageItems.length < 100) {
      break;
    }
  }
  return repositories;
}

export async function syncRepositories(userId: string): Promise<RepositoryDto[]> {
  const accessToken = await getAccessToken(userId);
  const githubRepositories = await requestGitHubRepositories(accessToken);
  const syncedAt = new Date().toISOString();
  const rows = githubRepositories.map((repository) => ({
    user_id: userId,
    github_repository_id: repository.id,
    owner_username: repository.owner.login,
    owner_avatar_url: repository.owner.avatar_url,
    name: repository.name,
    full_name: repository.full_name,
    description: repository.description,
    html_url: repository.html_url,
    default_branch: repository.default_branch || "main",
    primary_language: repository.language,
    visibility: repository.private ? "private" : "public",
    star_count: repository.stargazers_count,
    fork_count: repository.forks_count,
    pushed_at: repository.pushed_at || repository.updated_at,
    synced_at: syncedAt,
  }));

  if (rows.length > 0) {
    const { error } = await getSupabaseClient()
      .from("repositories")
      .upsert(rows, { onConflict: "user_id,github_repository_id" });
    if (error) {
      throw new Error("Unable to store GitHub repositories.");
    }
  }

  const result = await listRepositories(userId, { limit: 1000 });
  return result.repositories;
}

export async function listRepositories(
  userId: string,
  options: { q?: string; visibility?: "public" | "private" | "all"; limit: number; offset?: number },
): Promise<{ repositories: RepositoryDto[]; hasNextPage: boolean; nextOffset: number | null }> {
  const { data, error } = await getSupabaseClient()
    .from("repositories")
    .select("id, github_repository_id, owner_username, owner_avatar_url, name, full_name, description, html_url, default_branch, primary_language, visibility, star_count, fork_count, pushed_at, synced_at")
    .eq("user_id", userId)
    .order("pushed_at", { ascending: false });

  if (error) {
    throw new Error("Unable to load repositories.");
  }

  const normalizedQuery = options.q?.trim().toLocaleLowerCase() ?? "";
  const records = ((data ?? []) as RepositoryRecord[]).filter((repository) => {
    const visibilityMatches = !options.visibility || options.visibility === "all" || repository.visibility === options.visibility;
    const queryMatches = !normalizedQuery
      || repository.name.toLocaleLowerCase().includes(normalizedQuery)
      || repository.description?.toLocaleLowerCase().includes(normalizedQuery);
    return visibilityMatches && queryMatches;
  });
  const offset = options.offset ?? 0;
  const page = records.slice(offset, offset + options.limit);
  const nextOffset = offset + options.limit < records.length ? offset + options.limit : null;

  return {
    repositories: page.map(mapRepository),
    hasNextPage: nextOffset !== null,
    nextOffset,
  };
}

export async function getRepository(userId: string, repositoryId: string): Promise<RepositoryDto | null> {
  const loadRepository = () => getSupabaseClient()
    .from("repositories")
    .select("id, github_repository_id, owner_username, owner_avatar_url, name, full_name, description, html_url, default_branch, primary_language, visibility, star_count, fork_count, pushed_at, synced_at")
    .eq("user_id", userId)
    .eq("id", repositoryId)
    .maybeSingle();

  let result = await loadRepository();
  if (result.error) {
    result = await loadRepository();
  }

  if (result.error) {
    throw new RepositoryLookupError(repositoryId, result.error.code);
  }

  if (!result.data) {
    return null;
  }

  return mapRepository(result.data as RepositoryRecord);
}

export function encodeCursor(offset: number | null): string | null {
  return offset === null ? null : btoa(String(offset));
}

export function decodeCursor(value: string | null): number {
  if (!value) {
    return 0;
  }
  try {
    const offset = Number(atob(value));
    return Number.isInteger(offset) && offset >= 0 ? offset : 0;
  } catch {
    return 0;
  }
}
