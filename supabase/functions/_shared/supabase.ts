/**
 * Supabase client factory for Edge Functions.
 *
 * Two flavours:
 *   - `adminClient()` uses SUPABASE_SERVICE_ROLE_KEY — for privileged flows
 *     like signup (creating auth.users + public.stores in one txn).
 *   - `userClient(req)` forwards the caller's Authorization header so RLS
 *     runs against their JWT.
 */
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY     = Deno.env.get("SUPABASE_ANON_KEY")!;

export function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function userClient(req: Request): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, {
    global: {
      headers: { Authorization: req.headers.get("Authorization") ?? "" },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
