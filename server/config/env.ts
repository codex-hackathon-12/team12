type ServerEnvironment = {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  GITHUB_OAUTH_REDIRECT_URI?: string;
  TOKEN_ENCRYPTION_KEY?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
};

function required(name: keyof ServerEnvironment): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} server configuration is unavailable.`);
  }
  return value;
}

export function getSupabaseEnvironment(): Required<Pick<ServerEnvironment, "SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY">> {
  return {
    SUPABASE_URL: required("SUPABASE_URL"),
    SUPABASE_SERVICE_ROLE_KEY: required("SUPABASE_SERVICE_ROLE_KEY"),
  };
}

export function getGitHubEnvironment(): Required<Pick<ServerEnvironment, "GITHUB_CLIENT_ID" | "GITHUB_CLIENT_SECRET" | "GITHUB_OAUTH_REDIRECT_URI">> {
  return {
    GITHUB_CLIENT_ID: required("GITHUB_CLIENT_ID"),
    GITHUB_CLIENT_SECRET: required("GITHUB_CLIENT_SECRET"),
    GITHUB_OAUTH_REDIRECT_URI: required("GITHUB_OAUTH_REDIRECT_URI"),
  };
}

export function getTokenEncryptionKey(): string {
  return required("TOKEN_ENCRYPTION_KEY");
}

export function getOpenAIEnvironment(): { apiKey: string; model: string } {
  return {
    apiKey: required("OPENAI_API_KEY"),
    model: process.env.OPENAI_MODEL || "gpt-5.6-luna",
  };
}
