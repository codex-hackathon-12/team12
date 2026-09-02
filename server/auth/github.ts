import type { GitHubConnectionDto, GitHubScopeDto } from "@/contracts/api-contract";
import { REQUESTED_SCOPES } from "@/lib/scopes";

export { REQUESTED_SCOPES };
import { encryptSecret } from "@/server/auth/crypto";
import { isTokenExpiring } from "@/server/auth/github-token";
import { getGitHubEnvironment } from "@/server/config/env";
import { TIMEOUTS, fetchWithTimeout } from "@/server/net/fetch";
import { getSupabaseClient } from "@/server/supabase/client";


/* GitHub는 토큰 응답에서 스코프를 쉼표로 이어 준다("repo,read:org"). 공백으로만 자르면
   통째로 한 덩어리가 저장돼 어떤 권한을 받았는지 비교할 수 없다. */
function parseScopes(raw: string | null | undefined): string[] {
  return (raw ?? "")
    .split(/[,\s]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
}

type GitHubTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
  scope?: string;
  error?: string;
};

type GitHubUserResponse = {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
  html_url: string;
};

function getConfig() {
  return getGitHubEnvironment();
}

export function getGitHubAuthorizationUrl(state: string): string {
  const config = getConfig();
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", config.GITHUB_CLIENT_ID);
  url.searchParams.set("redirect_uri", config.GITHUB_OAUTH_REDIRECT_URI);
  url.searchParams.set("scope", REQUESTED_SCOPES.map((scope) => scope.name).join(" "));
  url.searchParams.set("state", state);
  return url.toString();
}

async function exchangeCode(code: string): Promise<GitHubTokenResponse> {
  const config = getConfig();
  const response = await fetchWithTimeout(
    "https://github.com/login/oauth/access_token",
    {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: config.GITHUB_CLIENT_ID,
        client_secret: config.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: config.GITHUB_OAUTH_REDIRECT_URI,
      }),
    },
    TIMEOUTS.oauth,
  );

  if (!response.ok) {
    throw new Error("GitHub token exchange failed.");
  }

  return response.json() as Promise<GitHubTokenResponse>;
}

async function getGitHubUser(accessToken: string): Promise<GitHubUserResponse> {
  const response = await fetchWithTimeout(
    "https://api.github.com/user",
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "job-portfolio-ai",
      },
    },
    TIMEOUTS.oauth,
  );

  if (!response.ok) {
    throw new Error("GitHub user lookup failed.");
  }

  return response.json() as Promise<GitHubUserResponse>;
}

export async function connectGitHubAccount(code: string): Promise<string> {
  const token = await exchangeCode(code);
  if (!token.access_token || token.error) {
    throw new Error("GitHub OAuth was denied.");
  }

  const githubUser = await getGitHubUser(token.access_token);
  const accessToken = await encryptSecret(token.access_token);
  const refreshToken = token.refresh_token ? await encryptSecret(token.refresh_token) : null;
  const expiresAt = token.expires_in
    ? new Date(Date.now() + token.expires_in * 1000).toISOString()
    : null;
  const scopes = parseScopes(token.scope);
  const supabase = getSupabaseClient();
  const { data: user, error: userError } = await supabase
    .from("users")
    .upsert(
      {
        github_user_id: githubUser.id,
        username: githubUser.login,
        display_name: githubUser.name || githubUser.login,
        email: githubUser.email,
        avatar_url: githubUser.avatar_url,
        profile_url: githubUser.html_url,
      },
      { onConflict: "github_user_id" },
    )
    .select("id")
    .single();

  if (userError || !user) {
    throw new Error("Unable to persist GitHub user.");
  }

  const { error: connectionError } = await supabase.from("github_connections").upsert(
    {
      user_id: user.id,
      provider_user_id: githubUser.id,
      access_token_ciphertext: accessToken.ciphertext,
      access_token_iv: accessToken.iv,
      refresh_token_ciphertext: refreshToken?.ciphertext ?? null,
      refresh_token_iv: refreshToken?.iv ?? null,
      token_expires_at: expiresAt,
      scopes,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (connectionError) {
    throw new Error("Unable to persist GitHub connection.");
  }

  return user.id;
}

export function getGitHubConnectionSettingsUrl(): string {
  return `https://github.com/settings/connections/applications/${getConfig().GITHUB_CLIENT_ID}`;
}

export async function getGitHubConnection(user: {
  id: string;
  username: string;
  avatarUrl: string;
  profileUrl: string;
}): Promise<GitHubConnectionDto | null> {
  const { data, error } = await getSupabaseClient()
    .from("github_connections")
    .select("scopes, connected_at, token_expires_at, refresh_token_ciphertext")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  /* 예전에 저장된 값은 쉼표로 이어진 한 덩어리일 수 있다. 읽을 때도 한 번 더 편다. */
  const granted = new Set(parseScopes((data.scopes ?? []).join(" ")));
  const scopes: GitHubScopeDto[] = REQUESTED_SCOPES.map((scope) => ({
    ...scope,
    granted: granted.has(scope.name),
  }));

  return {
    username: user.username,
    profileUrl: user.profileUrl,
    avatarUrl: user.avatarUrl,
    connectedAt: data.connected_at,
    scopes,
    extraScopes: [...granted].filter(
      (scope) => !REQUESTED_SCOPES.some((requested) => requested.name === scope),
    ),
    /* 만료된 토큰이라도 refresh token이 있으면 다음 호출에서 스스로 갱신된다.
       갱신할 수단이 없을 때만 사용자에게 재연동을 요구한다. */
    needsReauthorization:
      scopes.some((scope) => !scope.granted) ||
      (isTokenExpiring(data.token_expires_at) && !data.refresh_token_ciphertext),
    manageUrl: getGitHubConnectionSettingsUrl(),
  };
}
