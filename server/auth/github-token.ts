import { decryptSecret, encryptSecret } from "@/server/auth/crypto";
import { getGitHubEnvironment } from "@/server/config/env";
import { TIMEOUTS, fetchWithTimeout } from "@/server/net/fetch";
import { getSupabaseClient } from "@/server/supabase/client";

/**
 * 만료를 고려해 GitHub 액세스 토큰을 돌려준다.
 *
 * 이 OAuth App은 만료형 토큰을 쓴다(실제 연동 행에 token_expires_at이 채워져 있다).
 * 토큰 수명은 여덟 시간 남짓인데 서비스 세션은 14일이라, 로그인 상태 그대로
 * 저장소 동기화와 생성만 조용히 깨지는 구간이 생긴다. 그래서 쓰기 직전에
 * 만료를 확인하고 필요하면 갱신한다.
 *
 * refresh_token은 연동할 때부터 저장하고 있었지만 여태 읽는 곳이 없었다.
 */

/* 호출 도중에 만료되는 일이 없도록 여유를 두고 미리 갱신한다. */
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

export class GitHubTokenExpiredError extends Error {
  constructor(message = "GitHub authorization expired.") {
    super(message);
    // step 경계를 넘으면 클래스가 사라지므로 이름으로 분류한다.
    this.name = "GitHubConnectionError";
  }
}

type ConnectionRecord = {
  access_token_ciphertext: string;
  access_token_iv: string;
  refresh_token_ciphertext: string | null;
  refresh_token_iv: string | null;
  token_expires_at: string | null;
};

const CONNECTION_COLUMNS =
  "access_token_ciphertext, access_token_iv, refresh_token_ciphertext, refresh_token_iv, token_expires_at";

export function isTokenExpiring(
  expiresAt: string | null,
  now: number = Date.now(),
): boolean {
  if (!expiresAt) {
    // 만료 정보가 없는 연동은 만료되지 않는 토큰으로 본다.
    return false;
  }
  const expiry = Date.parse(expiresAt);
  return Number.isFinite(expiry) && expiry - now <= REFRESH_MARGIN_MS;
}

type RefreshResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
};

async function requestRefresh(refreshToken: string): Promise<RefreshResponse> {
  const config = getGitHubEnvironment();
  const response = await fetchWithTimeout(
    "https://github.com/login/oauth/access_token",
    {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: config.GITHUB_CLIENT_ID,
        client_secret: config.GITHUB_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    },
    TIMEOUTS.oauth,
  );

  if (!response.ok) {
    throw new GitHubTokenExpiredError("GitHub token refresh failed.");
  }
  return (await response.json()) as RefreshResponse;
}

/**
 * 만료가 임박했으면 갱신해 저장하고, 쓸 수 있는 액세스 토큰을 돌려준다.
 * 갱신할 수 없으면 재연동이 필요하다는 뜻이므로 연결 오류로 알린다.
 */
export async function getUsableAccessToken(userId: string): Promise<string> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("github_connections")
    .select(CONNECTION_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    throw new GitHubTokenExpiredError("GitHub account is not connected.");
  }

  const connection = data as ConnectionRecord;
  if (!isTokenExpiring(connection.token_expires_at)) {
    return decryptSecret(connection.access_token_ciphertext, connection.access_token_iv);
  }

  if (!connection.refresh_token_ciphertext || !connection.refresh_token_iv) {
    throw new GitHubTokenExpiredError("GitHub authorization expired and cannot be refreshed.");
  }

  const refreshToken = await decryptSecret(
    connection.refresh_token_ciphertext,
    connection.refresh_token_iv,
  );
  const refreshed = await requestRefresh(refreshToken);
  if (!refreshed.access_token || refreshed.error) {
    throw new GitHubTokenExpiredError("GitHub refused to refresh the authorization.");
  }

  const accessToken = await encryptSecret(refreshed.access_token);
  const nextRefreshToken = refreshed.refresh_token
    ? await encryptSecret(refreshed.refresh_token)
    : null;

  const { error: updateError } = await supabase
    .from("github_connections")
    .update({
      access_token_ciphertext: accessToken.ciphertext,
      access_token_iv: accessToken.iv,
      ...(nextRefreshToken
        ? {
            refresh_token_ciphertext: nextRefreshToken.ciphertext,
            refresh_token_iv: nextRefreshToken.iv,
          }
        : {}),
      token_expires_at: refreshed.expires_in
        ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
        : null,
    })
    .eq("user_id", userId);

  /* 저장에 실패해도 방금 받은 토큰은 유효하다. 이번 요청은 진행시키고
     다음 호출에서 다시 갱신하게 둔다. */
  if (updateError) {
    return refreshed.access_token;
  }

  return refreshed.access_token;
}
