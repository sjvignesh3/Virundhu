/**
 * Error normalization — every repo funnels PostgREST / Auth / Edge Function
 * errors through this module so the UI only ever sees `ApiError` codes from
 * `@virundhu/shared`.
 */
import type { PostgrestError, AuthError } from "@supabase/supabase-js";
import { type ApiErrorCode } from "@virundhu/shared";
export declare class ClientApiError extends Error {
    readonly code: ApiErrorCode;
    readonly status: number;
    readonly cause?: unknown;
    constructor(code: ApiErrorCode, message: string, status?: number, cause?: unknown);
}
/**
 * Map a PostgREST error to an ApiErrorCode. Uses the SQLSTATE `code` field
 * plus a few known error patterns from our RPCs.
 */
export declare function fromPostgrest(err: PostgrestError): ClientApiError;
export declare function fromAuth(err: AuthError): ClientApiError;
/**
 * Wrap a promise that resolves to `{ data, error }` (Supabase shape) so the
 * repo call site can just `await unwrap(client.from('x').select(…))`.
 */
export declare function unwrap<T>(op: PromiseLike<{
    data: T | null;
    error: PostgrestError | null;
}>): Promise<T>;
export declare function unwrapMaybe<T>(op: PromiseLike<{
    data: T | null;
    error: PostgrestError | null;
}>): Promise<T | null>;
