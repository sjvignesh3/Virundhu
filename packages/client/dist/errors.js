import { API_ERROR_CODES } from "@virundhu/shared";
export class ClientApiError extends Error {
    code;
    status;
    cause;
    constructor(code, message, status = 400, cause) {
        super(message);
        this.name = "ClientApiError";
        this.code = code;
        this.status = status;
        this.cause = cause;
    }
}
/**
 * Map a PostgREST error to an ApiErrorCode. Uses the SQLSTATE `code` field
 * plus a few known error patterns from our RPCs.
 */
export function fromPostgrest(err) {
    const code = err.code;
    const msg = err.message ?? "Database error";
    switch (code) {
        case "23505": // unique_violation
            return new ClientApiError(API_ERROR_CODES.CONFLICT, msg, 409, err);
        case "23503": // foreign_key_violation
            return new ClientApiError(API_ERROR_CODES.BAD_REQUEST, msg, 400, err);
        case "22023": // invalid_parameter_value
            return new ClientApiError(API_ERROR_CODES.VALIDATION_ERROR, msg, 400, err);
        case "42501": // insufficient_privilege → RLS deny
            return new ClientApiError(API_ERROR_CODES.FORBIDDEN, msg, 403, err);
        case "P0001": // raise_exception — our RPCs use this for domain rules
            if (/slug/i.test(msg)) {
                return new ClientApiError(API_ERROR_CODES.CONFLICT, msg, 409, err);
            }
            if (/transition/i.test(msg)) {
                return new ClientApiError(API_ERROR_CODES.INVALID_STATUS_TRANSITION, msg, 400, err);
            }
            if (/stock|available/i.test(msg)) {
                return new ClientApiError(API_ERROR_CODES.PRODUCT_UNAVAILABLE, msg, 409, err);
            }
            return new ClientApiError(API_ERROR_CODES.BAD_REQUEST, msg, 400, err);
        case "PGRST116": // no rows returned when .single() expected
            return new ClientApiError(API_ERROR_CODES.NOT_FOUND, msg, 404, err);
        default:
            return new ClientApiError(API_ERROR_CODES.INTERNAL_ERROR, msg, 500, err);
    }
}
export function fromAuth(err) {
    const msg = err.message ?? "Auth error";
    if (/invalid.*credentials|invalid.*login/i.test(msg)) {
        return new ClientApiError(API_ERROR_CODES.INVALID_CREDENTIALS, msg, 401, err);
    }
    if (/already registered|already been registered/i.test(msg)) {
        return new ClientApiError(API_ERROR_CODES.EMAIL_TAKEN, msg, 409, err);
    }
    if (/email not confirmed/i.test(msg)) {
        return new ClientApiError(API_ERROR_CODES.EMAIL_NOT_VERIFIED, msg, 403, err);
    }
    return new ClientApiError(API_ERROR_CODES.UNAUTHORIZED, msg, 401, err);
}
/**
 * Wrap a promise that resolves to `{ data, error }` (Supabase shape) so the
 * repo call site can just `await unwrap(client.from('x').select(…))`.
 */
export async function unwrap(op) {
    const { data, error } = await op;
    if (error)
        throw fromPostgrest(error);
    if (data === null) {
        throw new ClientApiError(API_ERROR_CODES.NOT_FOUND, "Not found", 404);
    }
    return data;
}
export async function unwrapMaybe(op) {
    const { data, error } = await op;
    if (error)
        throw fromPostgrest(error);
    return data;
}
