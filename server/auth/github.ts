import { env } from "cloudflare:workers";
import { encryptSecret } from "@/server/auth/crypto";
import { getSupabaseClient } from "@/server/supabase/client";

type GitHubEnv = {
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  GITHUB_OAUTH_REDIRECT_URI?: string;
};

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

function getConfig(): Required<GitHubEnv> {
  const config = env as GitHubEnv;
  if (!config.GITHUB_CLIENT_ID || !config.GITHUB_CLIENT_SECRET || !config.GITHUB_OAUTH_REDIRECT_URI) {
    throw new Error("GitHub OAuth configuration is unavailable.");
  }
  return {
    GITHUB_CLIENT_ID: config.GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET: config.GITHUB_CLIENT_SECRET,
    GITHUB_OAUTH_REDIRECT_URI: config.GITHUB_OAUTH_REDIRECT_URI,
  };
}

export function getGitHubAuthorizationUrl(state: string): string {
  const config = getConfig();
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", config.GITHUB_CLIENT_ID);
  url.searchParams.set("redirect_uri", config.GITHUB_OAUTH_REDIRECT_URI);
  url.searchParams.set("scope", "read:user user:email repo read:org");
  url.searchParams.set("state", state);
  return url.toString();
}

async function exchangeCode(code: string): Promise<GitHubTokenResponse> {
  const config = getConfig();
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: config.GITHUB_CLIENT_ID,
      client_secret: config.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: config.GITHUB_OAUTH_REDIRECT_URI,
    }),
  });

  if (!response.ok) {
    throw new Error("GitHub token exchange failed.");
  }

  return response.json() as Promise<GitHubTokenResponse>;
}

async function getGitHubUser(accessToken: string): Promise<GitHubUserResponse> {
  const response = await fetch("https://api.github.com/user", {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "job-portfolio-ai",
    },
  });

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
  const scopes = token.scope?.split(" ").filter(Boolean) ?? [];
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
