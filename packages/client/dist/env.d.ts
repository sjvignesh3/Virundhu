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
export declare function configureSupabaseEnv(env: Partial<SupabaseEnv> & Pick<SupabaseEnv, "url" | "anonKey">): void;
export declare function getSupabaseEnv(): SupabaseEnv;
/**
 * Test hook — resets any injected override. Never called from app code.
 */
export declare function _resetSupabaseEnvForTests(): void;
export {};
