/**
 * Supabase JS singleton, strongly typed against `Database` from
 * `@virundhu/shared/db-types`. The SPA imports this everywhere.
 */
import { type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@virundhu/shared";
export declare function getSupabase(): SupabaseClient<Database>;
/**
 * Test hook — drops the cached client so a subsequent call rebuilds against
 * a mocked env. Never called from app code.
 */
export declare function _resetSupabaseForTests(): void;
