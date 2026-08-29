/**
 * Notification contract â€” shared by the client (for optimistic copy), the
 * `notify-order-transition` Edge Function (for dispatch), and tests.
 *
 * Provider-agnostic by design: the Edge Function selects a concrete
 * dispatcher (log-only stub in Phase 5a â†’ WhatsApp Cloud API in Phase 5b)
 * behind this interface, so the fan-out call site never changes.
 *
 * Dependency-free (no Node, no Deno, no React) so it is importable everywhere.
 */

import type { OrderStatus } from "./enums.ts";
import { canTransition } from "./transitions.ts";

/**
 * The customer-facing transitions worth a push. NEW/ACCEPTEDâ†’PREPARING is
 * kitchen-internal and intentionally NOT notified to avoid message spam and
 * to protect the free-tier WhatsApp/message budget.
 */
export const NOTIFIABLE_KINDS = [
  "ORDER_ACCEPTED",
  "ORDER_READY",
  "ORDER_COMPLETED",
  "ORDER_CANCELLED",
] as const;
export type NotificationKind = (typeof NOTIFIABLE_KINDS)[number];

export interface NotificationPayload {
  orderId: string;
  storeId: string;
  orderNumber: string;
  /** E.164 phone if the customer supplied one; dispatch is skipped when null. */
  customerPhone: string | null;
  customerName: string | null;
  storeName: string;
}

export interface NotificationDispatcher {
  send(kind: NotificationKind, payload: NotificationPayload): Promise<void>;
}

/**
 * Maps a target order status to a notification kind. Returns `null` for
 * statuses we deliberately do not notify on (NEW, PREPARING) â€” the caller
 * skips dispatch in that case.
 */
export function notificationKindFor(to: OrderStatus): NotificationKind | null {
  switch (to) {
    case "ACCEPTED":
      return "ORDER_ACCEPTED";
    case "READY":
      return "ORDER_READY";
    case "COMPLETED":
      return "ORDER_COMPLETED";
    case "CANCELLED":
      return "ORDER_CANCELLED";
    default:
      return null;
  }
}

/**
 * Guard reused by the Edge Function: a fan-out request is only honoured when
 * the transition is legal AND maps to a notifiable kind. Reuses the SAME
 * state machine the client and DB use â€” no drift possible.
 */
export function shouldNotify(
  from: OrderStatus,
  to: OrderStatus,
): { ok: true; kind: NotificationKind } | { ok: false; reason: string } {
  if (from === to) {
    return { ok: false, reason: "NO_OP_TRANSITION" };
  }
  if (!canTransition(from, to)) {
    return { ok: false, reason: "INVALID_TRANSITION" };
  }
  const kind = notificationKindFor(to);
  if (!kind) {
    return { ok: false, reason: "NON_NOTIFIABLE_STATUS" };
  }
  return { ok: true, kind };
}

/** Default human-readable message body, reused by any dispatcher. */
export function renderNotificationText(
  kind: NotificationKind,
  payload: NotificationPayload,
): string {
  const who = payload.customerName ? `${payload.customerName}, y` : "Y";
  const order = `order ${payload.orderNumber}`;
  switch (kind) {
    case "ORDER_ACCEPTED":
      return `${who}our ${order} at ${payload.storeName} has been accepted and is queued.`;
    case "ORDER_READY":
      return `${who}our ${order} at ${payload.storeName} is ready for pickup.`;
    case "ORDER_COMPLETED":
      return `${who}our ${order} at ${payload.storeName} is complete. Thank you!`;
    case "ORDER_CANCELLED":
      return `${who}our ${order} at ${payload.storeName} was cancelled. Please contact the store.`;
  }
}

/**
 * Log-only dispatcher (Phase 5a). Safe default when no messaging provider is
 * configured â€” keeps the fan-out path exercisable in local dev and CI without
 * external secrets or invocation cost.
 */
export class LogNotificationDispatcher implements NotificationDispatcher {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private readonly sink: (...args: any[]) => void = console.log) {}

  async send(kind: NotificationKind, payload: NotificationPayload): Promise<void> {
    this.sink("[notify]", kind, {
      orderId: payload.orderId,
      orderNumber: payload.orderNumber,
      text: renderNotificationText(kind, payload),
    });
  }
}
