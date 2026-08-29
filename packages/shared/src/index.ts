/**
 * @virundhu/shared â€” API contract shared by the web client, the legacy
 * NestJS API, and the new Supabase backend (Postgres RPCs + Deno Edge Functions).
 *
 * Everything exported here is safe on both server and client (no Node-only
 * deps, no React deps). Keep it small and dependency-free apart from Zod.
 */

export * from "./enums.ts";
export * from "./types.ts";
export * from "./schemas.ts";
export * from "./api-errors.ts";
export * from "./transitions.ts";
export * from "./totals.ts";
export * from "./notifications.ts";
export type {
  Database,
  Json,
  StoreRow,
  StoreInsert,
  StoreUpdate,
  StoreMemberRow,
  StoreMemberInsert,
  StoreMemberUpdate,
  CategoryRow,
  CategoryInsert,
  CategoryUpdate,
  ProductRow,
  ProductInsert,
  ProductUpdate,
  OrderRow,
  OrderInsert,
  OrderUpdate,
  OrderItemRow,
  OrderItemInsert,
  OrderItemUpdate,
  PrinterRow,
  PrinterInsert,
  PrinterUpdate,
  AuditLogRow,
  AuditLogInsert,
  AuditLogUpdate,
  OrderSequenceRow,
  IdempotencyKeyRow,
  IdempotencyKeyInsert,
  IdempotencyKeyUpdate,
} from "./db-types.ts";
