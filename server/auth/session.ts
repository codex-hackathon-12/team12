import { getSupabaseClient } from "@/server/supabase/client";
import { hashToken, randomToken } from "@/server/auth/crypto";
import { parseCookie, serializeCookie } from "@/server/http";

export const SESSION_COOKIE_NAME = "portfolio_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

export type AuthenticatedUser = {
  id: string;
  githubUserId: string;
  username: string;
  displayName: string;
  email: string | null;
  avatarUrl: string;
  profileUrl: string;
  createdAt: string;
};

export async function createSession(userId: string): Promise<{ token: string; maxAge: number }> {
  const token = randomToken();
  const tokenHash = await hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000).toISOString();
  const { error } = await getSupabaseClient().from("sessions").insert({
    user_id: userId,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });

  if (error) {
    throw new Error("Unable to create a session.");
  }

  return { token, maxAge: SESSION_MAX_AGE_SECONDS };
}

export function sessionCookie(token: string, maxAge: number): string {
  return serializeCookie(SESSION_COOKIE_NAME, token, { maxAge });
}

export function expiredSessionCookie(): string {
  return serializeCookie(SESSION_COOKIE_NAME, "", { maxAge: 0 });
}

export async function getSessionUser(request: Request): Promise<AuthenticatedUser | null> {
  const token = parseCookie(request, SESSION_COOKIE_NAME);
  if (!token) {
    return null;
  }

  const tokenHash = await hashToken(token);
  const { data, error } = await getSupabaseClient()
    .from("sessions")
    .select("user_id, expires_at, revoked_at, users(id, github_user_id, username, display_name, email, avatar_url, profile_url, created_at)")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error || !data || data.revoked_at || new Date(data.expires_at).getTime() <= Date.now()) {
    return null;
  }

  const relatedUser = Array.isArray(data.users) ? data.users[0] : data.users;
  const user = relatedUser as {
    id: string;
    github_user_id: number;
    username: string;
    display_name: string;
    email: string | null;
    avatar_url: string;
    profile_url: string;
    created_at: string;
  } | null;

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    githubUserId: String(user.github_user_id),
    username: user.username,
    displayName: user.display_name,
    email: user.email,
    avatarUrl: user.avatar_url,
    profileUrl: user.profile_url,
    createdAt: user.created_at,
  };
}

export async function revokeSession(request: Request): Promise<void> {
  const token = parseCookie(request, SESSION_COOKIE_NAME);
  if (!token) {
    return;
  }

  const tokenHash = await hashToken(token);
  await getSupabaseClient()
    .from("sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("token_hash", tokenHash)
    .is("revoked_at", null);
}
