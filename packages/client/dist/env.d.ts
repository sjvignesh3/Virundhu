/**
 * Runtime env resolution. Supports both Vite (import.meta.env) and Node
 * (process.env) so this package can be consumed from the SPA and from
 * server-side scripts / tests alike.
 */
interface SupabaseEnv {
    url: string;
    anonKey: string;
}
export declare function configureSupabaseEnv(env: SupabaseEnv): void;
export declare function getSupabaseEnv(): SupabaseEnv;
/**
 * Test hook — resets any injected override. Never called from app code.
 */
export declare function _resetSupabaseEnvForTests(): void;
export {};
