import { signupSchema, loginSchema, } from "@virundhu/shared";
import { getSupabase } from "./supabase";
import { fromAuth, ClientApiError } from "./errors";
import { API_ERROR_CODES } from "@virundhu/shared";
export async function signup(input) {
    const parsed = signupSchema.safeParse(input);
    if (!parsed.success) {
        throw new ClientApiError(API_ERROR_CODES.VALIDATION_ERROR, "Invalid signup payload", 400, parsed.error.flatten());
    }
    const supabase = getSupabase();
    const { data, error } = await supabase.functions.invoke("auth-signup", {
        body: parsed.data,
    });
    if (error) {
        // Edge Functions return non-2xx as `FunctionsHttpError` — surface the JSON
        // body when the function returned a structured error envelope.
        const ctx = error.context;
        const bodyText = ctx?.body ?? "";
        let parsedBody = {};
        try {
            parsedBody = JSON.parse(bodyText);
        }
        catch {
            /* not JSON — fall through */
        }
        const code = mapEdgeCode(parsedBody.code);
        throw new ClientApiError(code, parsedBody.message ?? error.message ?? "Signup failed", 400, error);
    }
    const body = data;
    // If the Edge Function issued a session, install it locally so the app is
    // signed in without a second round-trip.
    let session = null;
    if (body.token && body.refreshToken) {
        const { data: setData, error: setErr } = await supabase.auth.setSession({
            access_token: body.token,
            refresh_token: body.refreshToken,
        });
        if (setErr)
            throw fromAuth(setErr);
        session = setData.session;
    }
    else {
        // Fallback path — sign in with the freshly created credentials.
        const { data: signed, error: signErr } = await supabase.auth.signInWithPassword({
            email: parsed.data.email,
            password: parsed.data.password,
        });
        if (signErr)
            throw fromAuth(signErr);
        session = signed.session;
    }
    return { user: body.user, store: body.store, session };
}
function mapEdgeCode(code) {
    switch (code) {
        case "VALIDATION_ERROR":
            return API_ERROR_CODES.VALIDATION_ERROR;
        case "SLUG_TAKEN":
            return API_ERROR_CODES.CONFLICT;
        case "RATE_LIMITED":
            return API_ERROR_CODES.RATE_LIMITED;
        case "SIGNUP_FAILED":
            return API_ERROR_CODES.EMAIL_TAKEN;
        case "PROVISION_FAILED":
            return API_ERROR_CODES.INTERNAL_ERROR;
        default:
            return API_ERROR_CODES.INTERNAL_ERROR;
    }
}
// ─── login ───────────────────────────────────────────────────────────────────
export async function login(input) {
    const parsed = loginSchema.safeParse(input);
    if (!parsed.success) {
        throw new ClientApiError(API_ERROR_CODES.VALIDATION_ERROR, "Invalid login payload", 400, parsed.error.flatten());
    }
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error)
        throw fromAuth(error);
    if (!data.session) {
        throw new ClientApiError(API_ERROR_CODES.INVALID_CREDENTIALS, "No session returned", 401);
    }
    return data.session;
}
// ─── logout ──────────────────────────────────────────────────────────────────
export async function logout() {
    const supabase = getSupabase();
    const { error } = await supabase.auth.signOut();
    if (error)
        throw fromAuth(error);
}
// ─── password reset ──────────────────────────────────────────────────────────
export async function requestPasswordReset(email) {
    const supabase = getSupabase();
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error)
        throw fromAuth(error);
}
export async function updatePassword(newPassword) {
    const supabase = getSupabase();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error)
        throw fromAuth(error);
}
// ─── helpers for route guards ────────────────────────────────────────────────
/**
 * Returns the primary store id from the current JWT `app_metadata.store_ids`.
 * Called by TanStack Router `beforeLoad` guards; throws when unauthenticated
 * so the route framework can redirect.
 */
export function requireStoreId(session) {
    if (!session) {
        throw new ClientApiError(API_ERROR_CODES.UNAUTHENTICATED, "Sign in required", 401);
    }
    const meta = session.user?.app_metadata;
    const storeId = meta?.store_ids?.[0];
    if (!storeId) {
        throw new ClientApiError(API_ERROR_CODES.FORBIDDEN, "No store on this account", 403);
    }
    return storeId;
}
