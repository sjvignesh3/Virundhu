/**
 * Supabase JS singleton, strongly typed against `Database` from
 * `@virundhu/shared/db-types`. The SPA imports this everywhere.
 */
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./env";
let cached = null;
export function getSupabase() {
    if (cached)
        return cached;
    const { url, anonKey } = getSupabaseEnv();
    cached = createClient(url, anonKey, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false,
            storageKey: "virundhu.auth",
        },
        global: {
            headers: { "x-client-info": "@virundhu/client@1.0.0" },
        },
    });
    return cached;
}
/**
 * Test hook — drops the cached client so a subsequent call rebuilds against
 * a mocked env. Never called from app code.
 */
export function _resetSupabaseForTests() {
    cached = null;
}
