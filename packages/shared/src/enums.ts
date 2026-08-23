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

export const PAYMENT_METHODS = ["SIMULATED", "UPI", "CARD", "CASH"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

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
