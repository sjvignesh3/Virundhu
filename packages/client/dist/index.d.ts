/**
 * @virundhu/client — typed data layer that fronts Supabase (PostgREST + Auth
 * + Realtime + Edge Functions). Consumed by the Vite SPA and any future
 * clients. Framework-agnostic; no React deps.
 */
export { configureSupabaseEnv, getSupabaseEnv, _resetSupabaseEnvForTests } from "./env";
export { getSupabase, _resetSupabaseForTests } from "./supabase";
export { signup, login, logout, requestPasswordReset, updatePassword, requireStoreId, } from "./auth";
export type { SignupResult } from "./auth";
export { useSession, initSessionStore, disposeSessionStore, selectSession, selectUser, selectClaim, selectIsAuthed, selectPrimaryStoreId, } from "./session-store";
export type { StoreClaim } from "./session-store";
export { ClientApiError, fromPostgrest, fromAuth, unwrap, unwrapMaybe } from "./errors";
export { authKeys, storeKeys, categoryKeys, productKeys, orderKeys, printerKeys, dashboardKeys, reportsKeys, publicMenuKeys, } from "./queryKeys";
export type { OrderListFilter as OrderListKeyFilter } from "./queryKeys";
export { STORE_LIST_COLUMNS, STORE_DETAIL_COLUMNS, CATEGORY_COLUMNS, PRODUCT_COLUMNS, ORDER_LIST_COLUMNS, ORDER_DETAIL_COLUMNS, PRINTER_COLUMNS, } from "./columns";
export * from "./repos";
