/**
 * admin-user-import Edge Function
 * ────────────────────────────────
 * Stage 6 §6.4 · Data migration cutover.
 *
 * Ingests owner accounts from the legacy NestJS/Prisma DB into Supabase Auth
 * WITHOUT forcing a password reset. The legacy DB stores bcrypt hashes; we
 * pass the raw hash through Supabase's admin-generate-link path which
 * accepts already-hashed passwords via `password_hash` on createUser.
 *
 * Request body (application/json):
 *   {
 *     "secret":  "…",             // shared secret; must equal env IMPORT_SECRET
 *     "batch":   [
 *       {
 *         "email":            "owner@example.com",
 *         "passwordHash":     "$2b$10$…",       // bcrypt from legacy `users.password`
 *         "name":             "Owner Name",
 *         "phone":            "+91…",           // optional
 *         "storeSlug":        "anna-street-food",
 *         "storeName":        "Anna Street Food",
 *         "legacyUserId":     "usr_…",          // for audit trace
 *         "legacyStoreId":    "str_…"
 *       },
 *       …
 *     ]
 *   }
 *
 * Response:
 *   { imported: [{ email, userId, storeId }], skipped: [{ email, reason }] }
 *
 * Idempotency:
 *   * Emails already present in auth.users are treated as `already_exists`
 *     and skipped — safe to re-run the batch after a partial failure.
 *   * Store slug collisions are surfaced as `slug_taken`; the operator
 *     resolves manually (typically by renaming the legacy slug).
 *
 * Auth model:
 *   * NOT invocable by end users. Deploy with `--no-verify-jwt` and gate on
 *     the shared secret; the function is only ever triggered by the cutover
 *     script running on the operator's laptop.
 */
import { adminClient } from "../_shared/supabase.ts";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { isValidBcryptHash } from "./bcrypt-guard.ts";

interface ImportRow {
  email:         string;
  passwordHash:  string;
  name:          string;
  phone?:        string | null;
  storeSlug:     string;
  storeName:     string;
  legacyUserId?: string;
  legacyStoreId?: string;
}

interface ImportBody {
  secret: string;
  batch:  ImportRow[];
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

  const expected = Deno.env.get("IMPORT_SECRET");
  if (!expected) {
    return new Response(
      JSON.stringify({ code: "IMPORT_DISABLED", message: "IMPORT_SECRET env var not set" }),
      { status: 503, headers },
    );
  }

  let body: ImportBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ code: "INVALID_JSON" }), { status: 400, headers });
  }

  if (body.secret !== expected) {
    return new Response(JSON.stringify({ code: "UNAUTHORIZED" }), { status: 401, headers });
  }
  if (!Array.isArray(body.batch) || body.batch.length === 0) {
    return new Response(JSON.stringify({ code: "EMPTY_BATCH" }), { status: 400, headers });
  }
  if (body.batch.length > 500) {
    // Keep batches bounded — the operator script pages through 500-row chunks.
    return new Response(
      JSON.stringify({ code: "BATCH_TOO_LARGE", max: 500 }),
      { status: 400, headers },
    );
  }

  const admin = adminClient();
  const imported: Array<{ email: string; userId: string; storeId: string }> = [];
  const skipped:  Array<{ email: string; reason: string }> = [];

  for (const row of body.batch) {
    try {
      // ── 1. shape guards ──────────────────────────────────────────────────
      if (!row.email || !row.passwordHash || !row.storeSlug || !row.storeName || !row.name) {
        skipped.push({ email: row.email ?? "(missing)", reason: "missing_fields" });
        continue;
      }
      if (!isValidBcryptHash(row.passwordHash)) {
        skipped.push({ email: row.email, reason: "invalid_password_hash" });
        continue;
      }

      // ── 2. slug availability ─────────────────────────────────────────────
      const slug = await admin.rpc("store_slug_available", { p_slug: row.storeSlug });
      if (slug.error || slug.data !== true) {
        skipped.push({ email: row.email, reason: "slug_taken" });
        continue;
      }

      // ── 3. create user with pre-hashed password ──────────────────────────
      //
      // The @supabase/supabase-js admin.createUser typings don't currently
      // surface `password_hash`, but the underlying GoTrue endpoint accepts
      // it. We cast through unknown to opt out of the type check for this
      // single field.
      const createRes = await admin.auth.admin.createUser({
        email:          row.email,
        email_confirm:  true,
        user_metadata:  { name: row.name, phone: row.phone ?? null, legacyUserId: row.legacyUserId ?? null },
        password_hash:  row.passwordHash,
      } as unknown as { email: string });

      if (createRes.error || !createRes.data.user) {
        // GoTrue returns 422 with message "User already registered" for dup emails.
        const msg = createRes.error?.message ?? "";
        if (msg.toLowerCase().includes("already")) {
          skipped.push({ email: row.email, reason: "already_exists" });
        } else {
          skipped.push({ email: row.email, reason: `create_failed:${msg}` });
        }
        continue;
      }

      const userId = createRes.data.user.id;

      // ── 4. provision store + membership ─────────────────────────────────
      const prov = await admin.rpc("provision_tenant", {
        p_user_id:    userId,
        p_store_name: row.storeName,
        p_store_slug: row.storeSlug,
        p_owner_name: row.name,
      });
      if (prov.error) {
        // roll back the user we just created so the row can be retried
        await admin.auth.admin.deleteUser(userId);
        skipped.push({ email: row.email, reason: `provision_failed:${prov.error.message}` });
        continue;
      }
      const store = prov.data as { id: string; slug: string; name: string };

      // ── 5. stamp app_metadata so JWT carries store_ids on first login ────
      await admin.auth.admin.updateUserById(userId, {
        app_metadata: {
          store_ids:      [store.id],
          role:           "OWNER",
          legacy_user_id: row.legacyUserId ?? null,
          legacy_store_id: row.legacyStoreId ?? null,
        },
      });

      imported.push({ email: row.email, userId, storeId: store.id });
    } catch (err) {
      skipped.push({
        email: row.email ?? "(unknown)",
        reason: `exception:${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  return new Response(
    JSON.stringify({ imported, skipped }),
    { status: 200, headers },
  );
});
