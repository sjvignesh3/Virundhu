/**
 * Runtime env resolution. Supports both Vite (import.meta.env) and Node
 * (process.env) so this package can be consumed from the SPA and from
 * server-side scripts / tests alike.
 */

interface SupabaseEnv {
  url: string;
  anonKey: string;
  /**
   * Base URL for the edge-cached public menu proxy (Plan §4.1).
   * Defaults to same-origin `/api/menu`. Set to an empty string to bypass
   * the proxy and read `public_store_menu` directly from Supabase — useful
   * for local dev without a Vercel dev server.
   */
  publicMenuBaseUrl: string;
}

interface ImportMetaEnvLike {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  VITE_PUBLIC_MENU_BASE_URL?: string;
}

const DEFAULT_PUBLIC_MENU_BASE = "/api/menu";

function readViteEnv(): Partial<SupabaseEnv> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meta = (import.meta as any) ?? {};
    const env = (meta.env ?? {}) as ImportMetaEnvLike;
    return {
      url: env.VITE_SUPABASE_URL,
      anonKey: env.VITE_SUPABASE_ANON_KEY,
      publicMenuBaseUrl: env.VITE_PUBLIC_MENU_BASE_URL,
    };
  } catch {
    return {};
  }
}

function readNodeEnv(): Partial<SupabaseEnv> {
  if (typeof process === "undefined" || !process.env) return {};
  return {
    url: process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL,
    anonKey:
      process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY,
    publicMenuBaseUrl: process.env.VITE_PUBLIC_MENU_BASE_URL,
  };
}

/**
 * Explicit override — the SPA bootstrap calls this once during app init to
 * feed values from Vite's import.meta.env. Repos / tests read the resolved
 * values via `getSupabaseEnv()`.
 */
let override: Partial<SupabaseEnv> | null = null;

export function configureSupabaseEnv(env: Partial<SupabaseEnv> & Pick<SupabaseEnv, "url" | "anonKey">): void {
  override = { ...env };
}

export function getSupabaseEnv(): SupabaseEnv {
  const merged: Partial<SupabaseEnv> = {
    ...readNodeEnv(),
    ...readViteEnv(),
    ...(override ?? {}),
  };
  if (!merged.url || !merged.anonKey) {
    throw new Error(
      "[@virundhu/client] Missing Supabase env. Set VITE_SUPABASE_URL and " +
        "VITE_SUPABASE_ANON_KEY, or call configureSupabaseEnv() during app init.",
    );
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
export function _resetSupabaseEnvForTests(): void {
  override = null;
}
