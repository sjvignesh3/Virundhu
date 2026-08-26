/**
 * @virundhu/shared — API contract shared by the web client, the legacy
 * NestJS API, and the new Supabase backend (Postgres RPCs + Deno Edge Functions).
 *
 * Everything exported here is safe on both server and client (no Node-only
 * deps, no React deps). Keep it small and dependency-free apart from Zod.
 */

export * from "./enums";
export * from "./types";
export * from "./schemas";
export * from "./api-errors";
export * from "./transitions";
export * from "./totals";
export * from "./notifications";
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
} from "./db-types";
