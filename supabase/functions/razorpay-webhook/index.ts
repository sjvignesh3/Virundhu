/**
 * razorpay-webhook Edge Function (Plan §5.3 + §5.4).
 * ──────────────────────────────────────────────────
 * BOILERPLATE — Stage 7 deferred Razorpay. This handler is retained so the
 * abstraction seam and its tests continue to compile, but the function is
 * NOT deployed (see supabase/config.toml) and returns 501 unless the
 * operator explicitly sets `RAZORPAY_ENABLED=1` on the function secrets.
 *
 * To re-enable when Razorpay goes live: set RAZORPAY_ENABLED=1,
 * uncomment the `[functions.razorpay-webhook]` block in config.toml,
 * redeploy, and follow Runbook §8.4.
 *
 * Original design:
 * Receives Razorpay webhook events, verifies the HMAC signature against the
 * RAW body, and applies `payment.captured` idempotently via `mark_payment_paid`.
 *
 * Safety:
 *   · Signature verified with the webhook secret (constant-time compare).
 *   · Idempotent twice over:
 *       - `mark_payment_paid` short-circuits on a duplicate provider_payment_id.
 *       - an `idempotency_keys` row (scope 'razorpay-webhook') guards the whole
 *         event by `event.id` so a replayed delivery is a no-op even before the RPC.
 *   · `verify_jwt = false` in config.toml — auth is the signature, not a JWT.
 *   · Provider toggle: PAYMENT_PROVIDER must be 'razorpay' to activate; when
 *     'simulated' (default) the function acknowledges without applying, so the
 *     endpoint can be wired at Razorpay before go-live.
 *
 * After a successful capture, the DB's own fan-out (from mark_payment_paid's
 * caller path) is NOT triggered — payment capture does not change order_status.
 * Any downstream "paid" notification is a Phase 5b concern.
 */
import { verifyRazorpaySignature } from "../_shared/razorpay.ts";
import { adminClient } from "../_shared/supabase.ts";

interface RazorpayEvent {
  id?: string;
  event?: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        notes?: { order_id?: string };
      };
    };
  };
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  // Stage 7 kill-switch — the function ships disabled by default. Anything
  // reaching this endpoint without the explicit opt-in gets 501 so
  // misrouted traffic is easy to spot in logs.
  if (Deno.env.get("RAZORPAY_ENABLED") !== "1") {
    return json({ code: "NOT_IMPLEMENTED", detail: "razorpay disabled in v1" }, 501);
  }

  if (req.method !== "POST") {
    return json({ code: "METHOD_NOT_ALLOWED" }, 405);
  }

  // Read the RAW body ONCE — signature is over these exact bytes.
  const raw = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";
  const secret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET") ?? "";

  const valid = await verifyRazorpaySignature(raw, signature, secret);
  if (!valid) {
    return json({ code: "INVALID_SIGNATURE" }, 401);
  }

  // Provider toggle — default 'simulated' acknowledges without applying.
  const provider = (Deno.env.get("PAYMENT_PROVIDER") ?? "simulated").toLowerCase();

  let event: RazorpayEvent;
  try {
    event = JSON.parse(raw) as RazorpayEvent;
  } catch {
    return json({ code: "INVALID_JSON" }, 400);
  }

  if (event.event !== "payment.captured") {
    // Acknowledge unhandled events so Razorpay stops retrying.
    return json({ ok: true, ignored: event.event ?? "unknown" }, 200);
  }

  if (provider !== "razorpay") {
    return json({ ok: true, mode: "simulated", ignored: true }, 200);
  }

  const entity = event.payload?.payment?.entity;
  const paymentId = entity?.id;
  const orderId = entity?.notes?.order_id;
  if (!paymentId || !orderId) {
    return json({ code: "MISSING_FIELDS" }, 400);
  }

  const admin = adminClient();

  // ─── event-level idempotency guard (Plan §5.4) ─────────────────────────────
  // Order matters: claim the key BEFORE applying, but RELEASE it if the apply
  // fails. Otherwise a transient RPC failure leaves the key behind and
  // Razorpay's retry short-circuits as "idempotent" — the capture would be
  // silently dropped. (mark_payment_paid is itself idempotent by
  // provider_payment_id, so a double-apply race is still safe.)
  if (event.id) {
    const guard = await admin
      .from("idempotency_keys")
      .insert({ key: event.id, scope: "razorpay-webhook" });
    // 23505 = unique_violation → already processed → no-op success.
    if (guard.error && guard.error.code === "23505") {
      return json({ ok: true, idempotent: true }, 200);
    }
    if (guard.error) {
      return json({ code: "IDEMPOTENCY_WRITE_FAILED", detail: guard.error.message }, 500);
    }
  }

  // ─── apply capture (idempotent by provider_payment_id) ─────────────────────
  const { data, error } = await admin.rpc("mark_payment_paid", {
    p_order_id: orderId,
    p_provider_payment_id: paymentId,
    p_provider: "razorpay",
  });

  if (error) {
    // Release the event key so Razorpay's retry re-attempts the apply.
    if (event.id) {
      await admin
        .from("idempotency_keys")
        .delete()
        .eq("key", event.id)
        .eq("scope", "razorpay-webhook");
    }
    return json({ code: "MARK_PAID_FAILED", detail: error.message }, 500);
  }

  return json({ ok: true, order: (data as { id?: string } | null)?.id ?? null }, 200);
});
