/**
 * notify-order-transition Edge Function (Plan §5.1 + §5.2).
 * ─────────────────────────────────────────────────────────
 * Invoked asynchronously by the DB via `pg_net.http_post` from
 * `orders_advance_status` / `orders_cancel` (see migration 20260901002300).
 *
 * Flow:
 *   1. Authorize: the caller must present `Authorization: Bearer <EDGE_SHARED_SECRET>`.
 *      pg_net sets this from the `app.edge_secret` GUC.
 *   2. Validate transition using the SAME `shouldNotify` guard from
 *      @virundhu/shared — the client and DB use the identical state machine.
 *   3. Load minimal order + store context (service_role, bypasses RLS).
 *   4. Dispatch via the configured NotificationDispatcher.
 *      Phase 5a: LogNotificationDispatcher (no external provider, zero cost).
 *      Phase 5b: swap for a WhatsApp Cloud API dispatcher — call site unchanged.
 *
 * Idempotency: notifications are advisory; a duplicate log line is harmless.
 * Real messaging providers should use `idempotency_keys` (see §5.4) keyed on
 * `${order_id}:${to_status}`.
 */
import {
  LogNotificationDispatcher,
  shouldNotify,
  type NotificationDispatcher,
  type NotificationPayload,
  type OrderStatus,
} from "@virundhu/shared";
import { adminClient } from "../_shared/supabase.ts";
import { corsHeaders, preflight } from "../_shared/cors.ts";

interface FanoutBody {
  order_id: string;
  from_status: OrderStatus;
  to_status: OrderStatus;
}

// Phase 5a dispatcher. Replace with a WhatsApp dispatcher in Phase 5b.
const dispatcher: NotificationDispatcher = new LogNotificationDispatcher();

function json(body: unknown, status: number, req: Request): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const cors = preflight(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return json({ code: "METHOD_NOT_ALLOWED" }, 405, req);
  }

  // ─── authorize the internal caller ─────────────────────────────────────────
  const expected = Deno.env.get("EDGE_SHARED_SECRET") ?? "";
  const provided = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!expected || provided !== expected) {
    return json({ code: "UNAUTHORIZED" }, 401, req);
  }

  // ─── parse + validate ──────────────────────────────────────────────────────
  let body: FanoutBody;
  try {
    body = (await req.json()) as FanoutBody;
  } catch {
    return json({ code: "INVALID_JSON" }, 400, req);
  }
  if (!body.order_id || !body.from_status || !body.to_status) {
    return json({ code: "MISSING_FIELDS" }, 400, req);
  }

  const decision = shouldNotify(body.from_status, body.to_status);
  if (!decision.ok) {
    // Legal no-op (e.g. PREPARING is not notifiable) — 200 so pg_net does not retry.
    return json({ ok: true, skipped: decision.reason }, 200, req);
  }

  // ─── load minimal context (service_role → bypasses RLS) ────────────────────
  const admin = adminClient();
  const { data, error } = await admin
    .from("orders")
    .select("id, store_id, order_number, customer_name, customer_phone, stores(name)")
    .eq("id", body.order_id)
    .single();

  if (error || !data) {
    return json({ code: "ORDER_NOT_FOUND", detail: error?.message }, 404, req);
  }

  const store = (data as { stores?: { name?: string } | null }).stores ?? null;
  const payload: NotificationPayload = {
    orderId: data.id as string,
    storeId: data.store_id as string,
    orderNumber: data.order_number as string,
    customerName: (data.customer_name as string | null) ?? null,
    customerPhone: (data.customer_phone as string | null) ?? null,
    storeName: store?.name ?? "the store",
  };

  // Skip dispatch when there is no reachable customer — still a success.
  if (!payload.customerPhone) {
    return json({ ok: true, skipped: "NO_CUSTOMER_PHONE", kind: decision.kind }, 200, req);
  }

  await dispatcher.send(decision.kind, payload);
  return json({ ok: true, kind: decision.kind }, 200, req);
});
