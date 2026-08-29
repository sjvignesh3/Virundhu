/**
 * auth-signup Edge Function
 * ─────────────────────────
 * Transactionally provisions a new tenant:
 *   1. Validate payload against @virundhu/shared/signupSchema (Deno import map).
 *   2. Reserve the slug (RPC store_slug_available).
 *   3. Create auth.users via admin API with app_metadata.store_ids set later.
 *   4. Insert stores + store_members atomically via an SQL RPC.
 *   5. Backfill app_metadata.store_ids on the freshly created user.
 *   6. Return the same shape as legacy /auth/signup { token, user, store }.
 *
 * Any step failure rolls back downstream state (best-effort user delete).
 */
import { signupSchema } from "@virundhu/shared";
import { adminClient } from "../_shared/supabase.ts";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { rateLimit, clientIp } from "../_shared/rate-limit.ts";

interface SignupResponse {
  token: string;
  refreshToken: string;
  user: { id: string; email: string; name?: string };
  store: { id: string; slug: string; name: string };
}

Deno.serve(async (req) => {
  const cors = preflight(req);
  if (cors) return cors;

  const headers = { ...corsHeaders(req), "content-type": "application/json" };

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ code: "METHOD_NOT_ALLOWED" }), {
      status: 405,
      headers,
    });
  }

  // ─── rate-limit (30 attempts / 5 min / IP) ────────────────────────────────
  const rl = rateLimit(`signup:${clientIp(req)}`, 30, 5 * 60_000);
  if (!rl.ok) {
    return new Response(
      JSON.stringify({ code: "RATE_LIMITED", retryAfterMs: rl.retryAfterMs }),
      { status: 429, headers: { ...headers, "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  // ─── payload validation ───────────────────────────────────────────────────
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return new Response(JSON.stringify({ code: "INVALID_JSON" }), { status: 400, headers });
  }
  const parsed = signupSchema.safeParse(raw);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ code: "VALIDATION_ERROR", issues: parsed.error.flatten() }),
      { status: 400, headers },
    );
  }
  const input = parsed.data;

  const admin = adminClient();

  // ─── slug availability ────────────────────────────────────────────────────
  // A transient RPC error must NOT masquerade as "taken" — report it as a
  // retryable 500 instead of telling the user their URL is unavailable.
  const slugCheck = await admin.rpc("store_slug_available", { p_slug: input.storeSlug });
  if (slugCheck.error) {
    return new Response(
      JSON.stringify({ code: "INTERNAL", message: "Could not verify slug availability. Try again." }),
      { status: 500, headers },
    );
  }
  if (slugCheck.data !== true) {
    return new Response(
      JSON.stringify({ code: "SLUG_TAKEN", message: "That store URL is already taken." }),
      { status: 409, headers },
    );
  }

  // ─── create auth user ─────────────────────────────────────────────────────
  const created = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { name: input.name, phone: input.phone ?? null },
  });
  if (created.error || !created.data.user) {
    return new Response(
      JSON.stringify({ code: "SIGNUP_FAILED", message: created.error?.message }),
      { status: 400, headers },
    );
  }
  const userId = created.data.user.id;

  // ─── create store + membership (SECURITY DEFINER RPC → single txn) ────────
  // Stage 7 : forward the (optional) storeUpiId so the vendor's VPA lands
  // on the fresh `stores` row for the checkout "Pay via UPI" button.
  const provision = await admin.rpc("provision_tenant", {
    p_user_id:      userId,
    p_store_name:   input.storeName,
    p_store_slug:   input.storeSlug,
    p_owner_name:   input.name,
    p_store_upi_id: input.storeUpiId ?? null,
  });
  if (provision.error) {
    // best-effort compensating action
    await admin.auth.admin.deleteUser(userId);
    return new Response(
      JSON.stringify({ code: "PROVISION_FAILED", message: provision.error.message }),
      { status: 500, headers },
    );
  }
  const store = provision.data as { id: string; slug: string; name: string };

  // ─── backfill JWT app_metadata ────────────────────────────────────────────
  await admin.auth.admin.updateUserById(userId, {
    app_metadata: { store_ids: [store.id], role: "OWNER" },
  });

  // ─── issue session ────────────────────────────────────────────────────────
  // Return a password-grant session so the client can proceed immediately
  // (JWT already carries the fresh app_metadata.store_ids we just set).
  const passwordSession = await admin.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });
  if (passwordSession.error || !passwordSession.data.session) {
    // Auth user exists and store exists — the client can still sign in on its
    // own. Return 201 with an empty token; the SPA will fall back to the
    // signInWithPassword call.
    return new Response(
      JSON.stringify({
        token: "",
        refreshToken: "",
        user:  { id: userId, email: input.email, name: input.name },
        store,
      } satisfies SignupResponse),
      { status: 201, headers },
    );
  }

  const body: SignupResponse = {
    token:        passwordSession.data.session.access_token,
    refreshToken: passwordSession.data.session.refresh_token,
    user:         { id: userId, email: input.email, name: input.name },
    store,
  };
  return new Response(JSON.stringify(body), { status: 201, headers });
});
