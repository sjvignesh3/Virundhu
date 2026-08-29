/**
 * Runtime env resolution. Supports both Vite (import.meta.env) and Node
 * (process.env) so this package can be consumed from the SPA and from
 * server-side scripts / tests alike.
 */
const DEFAULT_PUBLIC_MENU_BASE = "/api/menu";
function readViteEnv() {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const meta = import.meta ?? {};
        const env = (meta.env ?? {});
        return {
            url: env.VITE_SUPABASE_URL,
            anonKey: env.VITE_SUPABASE_ANON_KEY,
            publicMenuBaseUrl: env.VITE_PUBLIC_MENU_BASE_URL,
        };
    }
    catch {
        return {};
    }
}
function readNodeEnv() {
    if (typeof process === "undefined" || !process.env)
        return {};
    return {
        url: process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL,
        anonKey: process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY,
        publicMenuBaseUrl: process.env.VITE_PUBLIC_MENU_BASE_URL,
    };
}
/**
 * Explicit override — the SPA bootstrap calls this once during app init to
 * feed values from Vite's import.meta.env. Repos / tests read the resolved
 * values via `getSupabaseEnv()`.
 */
let override = null;
export function configureSupabaseEnv(env) {
    override = { ...env };
}
export function getSupabaseEnv() {
    const merged = {
        ...readNodeEnv(),
        ...readViteEnv(),
        ...(override ?? {}),
    };
    if (!merged.url || !merged.anonKey) {
        throw new Error("[@virundhu/client] Missing Supabase env. Set VITE_SUPABASE_URL and " +
            "VITE_SUPABASE_ANON_KEY, or call configureSupabaseEnv() during app init.");
    }
    return {
        url: merged.url,
        anonKey: merged.anonKey,
        publicMenuBaseUrl: merged.publicMenuBaseUrl ?? DEFAULT_PUBLIC_MENU_BASE,
    };
}
/**
 * Test hook — resets any injected override. Never called from app code.
 */
export function _resetSupabaseEnvForTests() {
    override = null;
}
