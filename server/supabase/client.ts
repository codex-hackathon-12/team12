import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnvironment } from "@/server/config/env";

let client: SupabaseClient | undefined;

export function getSupabaseClient(): SupabaseClient {
  if (client) {
    return client;
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = getSupabaseEnvironment();

  client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  return client;
}
