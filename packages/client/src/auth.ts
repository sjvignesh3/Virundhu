/**
 * Auth surface — the SPA calls these; nothing else touches supabase.auth.*.
 *
 *   signup()   → invokes `auth-signup` Edge Function, then signs the user in
 *   login()    → password grant against Supabase Auth
 *   logout()   → clears session (local + broadcast to other tabs)
 *   requestPasswordReset()
 *   updatePassword()
 */
import type { Session } from "@supabase/supabase-js";
import {
  signupSchema,
  loginSchema,
  type SignupInput,
  type LoginInput,
} from "@virundhu/shared";
import { getSupabase } from "./supabase";
import { fromAuth, ClientApiError } from "./errors";
import { API_ERROR_CODES } from "@virundhu/shared";

// ─── signup via Edge Function ────────────────────────────────────────────────

export interface SignupResult {
  user: { id: string; email: string; name?: string };
  store: { id: string; slug: string; name: string };
  session: Session | null;
}

export async function signup(input: SignupInput): Promise<SignupResult> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) {
    throw new ClientApiError(
      API_ERROR_CODES.VALIDATION_ERROR,
      "Invalid signup payload",
      400,
      parsed.error.flatten(),
    );
  }

  const supabase = getSupabase();
  const { data, error } = await supabase.functions.invoke("auth-signup", {
    body: parsed.data,
  });

  if (error) {
    // Edge Functions return non-2xx as `FunctionsHttpError` whose `context`
    // is the raw fetch Response — the JSON error envelope must be read from
    // it asynchronously (reading a `.body` string property yields nothing,
    // which is why users used to see the generic "non-2xx status code").
    const ctx = (error as unknown as { context?: unknown }).context;
    let parsedBody: { code?: string; message?: string } = {};
    try {
      if (ctx instanceof Response) {
        parsedBody = (await ctx.clone().json()) as typeof parsedBody;
      } else if (typeof (ctx as { body?: unknown })?.body === "string") {
        parsedBody = JSON.parse((ctx as { body: string }).body) as typeof parsedBody;
      }
    } catch {
      /* not JSON — fall through */
    }
    const code = mapEdgeCode(parsedBody.code);
    throw new ClientApiError(
      code,
      parsedBody.message ?? error.message ?? "Signup failed",
      400,
      error,
    );
  }

  const body = data as {
    token: string;
    refreshToken: string;
    user: SignupResult["user"];
    store: SignupResult["store"];
  };

  // If the Edge Function issued a session, install it locally so the app is
  // signed in without a second round-trip.
  let session: Session | null = null;
  if (body.token && body.refreshToken) {
    const { data: setData, error: setErr } = await supabase.auth.setSession({
      access_token: body.token,
      refresh_token: body.refreshToken,
    });
    if (setErr) throw fromAuth(setErr);
    session = setData.session;
  } else {
    // Fallback path — sign in with the freshly created credentials.
    const { data: signed, error: signErr } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    if (signErr) throw fromAuth(signErr);
    session = signed.session;
  }

  return { user: body.user, store: body.store, session };
}

function mapEdgeCode(code: string | undefined) {
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

export async function login(input: LoginInput): Promise<Session> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    throw new ClientApiError(
      API_ERROR_CODES.VALIDATION_ERROR,
      "Invalid login payload",
      400,
      parsed.error.flatten(),
    );
  }
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) throw fromAuth(error);
  if (!data.session) {
    throw new ClientApiError(
      API_ERROR_CODES.INVALID_CREDENTIALS,
      "No session returned",
      401,
    );
  }
  return data.session;
}

// ─── logout ──────────────────────────────────────────────────────────────────

export async function logout(): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.auth.signOut();
  if (error) throw fromAuth(error);
}

// ─── password reset ──────────────────────────────────────────────────────────

export async function requestPasswordReset(email: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw fromAuth(error);
}

export async function updatePassword(newPassword: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw fromAuth(error);
}

// ─── helpers for route guards ────────────────────────────────────────────────

/**
 * Returns the primary store id from the current JWT `app_metadata.store_ids`.
 * Called by TanStack Router `beforeLoad` guards; throws when unauthenticated
 * so the route framework can redirect.
 */
export function requireStoreId(session: Session | null): string {
  if (!session) {
    throw new ClientApiError(
      API_ERROR_CODES.UNAUTHENTICATED,
      "Sign in required",
      401,
    );
  }
  const meta = session.user?.app_metadata as
    | { store_ids?: string[] }
    | undefined;
  const storeId = meta?.store_ids?.[0];
  if (!storeId) {
    throw new ClientApiError(
      API_ERROR_CODES.FORBIDDEN,
      "No store on this account",
      403,
    );
  }
  return storeId;
}
