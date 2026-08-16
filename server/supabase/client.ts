import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "cloudflare:workers";

type SupabaseServerEnv = {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

let client: SupabaseClient | undefined;

export function getSupabaseClient(): SupabaseClient {
  if (client) {
    return client;
  }

  const serverEnv = env as SupabaseServerEnv;
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = serverEnv;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase server configuration is unavailable.");
  }

  client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  return client;
}
