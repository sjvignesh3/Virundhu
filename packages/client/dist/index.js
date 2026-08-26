/**
 * @virundhu/client — typed data layer that fronts Supabase (PostgREST + Auth
 * + Realtime + Edge Functions). Consumed by the Vite SPA and any future
 * clients. Framework-agnostic; no React deps.
 */
// ─── Config + client singleton ───────────────────────────────────────────────
export { configureSupabaseEnv, getSupabaseEnv, _resetSupabaseEnvForTests } from "./env";
export { getSupabase, _resetSupabaseForTests } from "./supabase";
// ─── Auth surface ────────────────────────────────────────────────────────────
export { signup, login, logout, requestPasswordReset, updatePassword, requireStoreId, } from "./auth";
// ─── Session store (Zustand) ─────────────────────────────────────────────────
export { useSession, initSessionStore, disposeSessionStore, selectSession, selectUser, selectClaim, selectIsAuthed, selectPrimaryStoreId, } from "./session-store";
// ─── Errors ──────────────────────────────────────────────────────────────────
export { ClientApiError, fromPostgrest, fromAuth, unwrap, unwrapMaybe } from "./errors";
// ─── Query keys ──────────────────────────────────────────────────────────────
export { authKeys, storeKeys, categoryKeys, productKeys, orderKeys, printerKeys, dashboardKeys, reportsKeys, publicMenuKeys, } from "./queryKeys";
// ─── Column projections ──────────────────────────────────────────────────────
export { STORE_LIST_COLUMNS, STORE_DETAIL_COLUMNS, CATEGORY_COLUMNS, PRODUCT_COLUMNS, ORDER_LIST_COLUMNS, ORDER_DETAIL_COLUMNS, PRINTER_COLUMNS, } from "./columns";
// ─── Repos ───────────────────────────────────────────────────────────────────
export * from "./repos";
