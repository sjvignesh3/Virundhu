/**
 * Domain enums. Kept as string-literal union types + arrays so they can be
 * used for runtime validation (Zod.enum) and static typing.
 */

export const ORDER_STATUSES = [
  "NEW",
  "ACCEPTED",
  "PREPARING",
  "READY",
  "COMPLETED",
  "CANCELLED",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ACTIVE_ORDER_STATUSES = ["NEW", "ACCEPTED", "PREPARING", "READY"] as const;

export const PAYMENT_STATUSES = ["PENDING", "PAID", "FAILED", "REFUNDED"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/**
 * Payment methods.
 *
 * The DB enum still carries the historical values ("SIMULATED", "CARD",
 * "UPI", "CASH") — see `supabase/migrations/20260901000200_enums.sql` — so
 * legacy rows keep validating. The **product surface** is intentionally
 * narrower: customers may only pick CASH or UPI at checkout. SIMULATED and
 * CARD are kept as boilerplate for the future Razorpay path but must not
 * appear in UI copy or form dropdowns.
 *
 * When Razorpay is re-introduced (Phase 3), widen `ACTIVE_PAYMENT_METHODS`
 * — no schema change required.
 */
export const PAYMENT_METHODS = ["SIMULATED", "UPI", "CARD", "CASH"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Methods the customer can actually pick in v1. */
export const ACTIVE_PAYMENT_METHODS = ["CASH", "UPI"] as const;
export type ActivePaymentMethod = (typeof ACTIVE_PAYMENT_METHODS)[number];

/**
 * Payment providers. Kept for the abstraction seam; RAZORPAY is currently
 * boilerplate — no live gateway is wired. See Runbook §8.4.
 */
export const PAYMENT_PROVIDERS = ["SIMULATED", "RAZORPAY"] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

export const STORE_STATUSES = ["OPEN", "CLOSED"] as const;
export type StoreStatus = (typeof STORE_STATUSES)[number];

export const STORE_ROLES = ["OWNER", "MANAGER", "STAFF"] as const;
export type StoreRole = (typeof STORE_ROLES)[number];

export const UNITS = ["plate", "piece", "cup", "glass", "bottle", "kg", "g"] as const;
export type Unit = (typeof UNITS)[number];

export const LANGUAGES = ["en", "ta"] as const;
export type Language = (typeof LANGUAGES)[number];

export const PRINTER_TYPES = ["THERMAL", "LASER", "INKJET"] as const;
export type PrinterType = (typeof PRINTER_TYPES)[number];

export const PRINTER_CONNECTION_STATUSES = [
  "CONNECTED",
  "DISCONNECTED",
  "UNKNOWN",
] as const;
export type PrinterConnectionStatus = (typeof PRINTER_CONNECTION_STATUSES)[number];
