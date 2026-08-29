/**
 * db-types.ts — Supabase-generated PostgREST typings for `public` schema.
 *
 * ┌─ DO NOT EDIT BY HAND ─────────────────────────────────────────────────┐
 * │ This file is regenerated on every `main` merge that touches           │
 * │ supabase/migrations by:                                               │
 * │                                                                       │
 * │   npx supabase gen types typescript \                                 │
 * │     --project-id <REF> --schema public \                              │
 * │     > packages/shared/src/db-types.ts                                 │
 * │                                                                       │
 * │ See `.github/workflows/db-deploy.yml` job `types`.                    │
 * └───────────────────────────────────────────────────────────────────────┘
 *
 * Until Stage 1.1.4 provisions a staging project, this file ships a
 * hand-written subset that mirrors the migrations under
 * `supabase/migrations/`. It IS the source of truth the typed data layer
 * imports from — swap it out with the generated file on first CI run
 * against staging.
 *
 * Shape rule: define Row/Insert/Update as **standalone** interfaces so the
 * `Database` map does not self-reference during type inference. This is what
 * `supabase gen types` emits and it's the only shape `SupabaseClient<T>` can
 * resolve without collapsing generic parameters to `never`.
 */

import type {
  Language,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  PrinterConnectionStatus,
  PrinterType,
  StoreRole,
  StoreStatus,
  Unit,
} from "./enums";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ─── stores ───────────────────────────────────────────────────────────────────
export interface StoreRow {
  id: string;
  slug: string;
  name: string;
  tamil_name: string | null;
  description: string | null;
  status: StoreStatus;
  currency: string;
  tax_rate: number;
  logo_url: string | null;
  image_url: string | null;
  address: string | null;
  phone: string | null;
  upi_id: string | null;
  settings: Json;
  default_language: Language;
  show_tamil_names: boolean;
  show_unavailable: boolean;
  accept_orders: boolean;
  minimum_order_value: number;
  estimated_preparation_minutes: number;
  created_at: string;
  updated_at: string;
}
export type StoreInsert = Partial<StoreRow> & { slug: string; name: string };
export type StoreUpdate = Partial<StoreRow>;

// ─── store_members ────────────────────────────────────────────────────────────
export interface StoreMemberRow {
  store_id: string;
  user_id: string;
  role: StoreRole;
  created_at: string;
}
export type StoreMemberInsert = Omit<StoreMemberRow, "created_at"> & { created_at?: string };
export type StoreMemberUpdate = Partial<StoreMemberRow>;

// ─── categories ───────────────────────────────────────────────────────────────
export interface CategoryRow {
  id: string;
  store_id: string;
  name: string;
  tamil_name: string | null;
  description: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
export type CategoryInsert = Omit<CategoryRow, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};
export type CategoryUpdate = Partial<CategoryRow>;

// ─── products ─────────────────────────────────────────────────────────────────
export interface ProductRow {
  id: string;
  store_id: string;
  category_id: string | null;
  name: string;
  tamil_name: string | null;
  description: string | null;
  tamil_description: string | null;
  price: number;
  unit: Unit;
  image_url: string | null;
  is_available: boolean;
  stock_quantity: number | null;
  low_stock_threshold: number | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}
export type ProductInsert = Omit<ProductRow, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};
export type ProductUpdate = Partial<ProductRow>;

// ─── orders ───────────────────────────────────────────────────────────────────
export interface OrderRow {
  id: string;
  store_id: string;
  order_number: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod | null;
  customer_name: string | null;
  customer_phone: string | null;
  notes: string | null;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  cancel_reason: string | null;
  provider_payment_id: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}
export type OrderInsert = Partial<OrderRow> & {
  store_id: string;
  order_number: string;
  total_amount: number;
};
export type OrderUpdate = Partial<OrderRow>;

// ─── order_items ──────────────────────────────────────────────────────────────
export interface OrderItemRow {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  product_tamil_name: string | null;
  unit: Unit;
  unit_price: number;
  quantity: number;
  line_total: number;
  notes: string | null;
  created_at: string;
}
export type OrderItemInsert = Omit<OrderItemRow, "id" | "line_total" | "created_at"> & {
  id?: string;
  created_at?: string;
};
export type OrderItemUpdate = Partial<OrderItemRow>;

// ─── printers ─────────────────────────────────────────────────────────────────
export interface PrinterRow {
  id: string;
  store_id: string;
  name: string;
  type: PrinterType;
  connection_status: PrinterConnectionStatus;
  address: string | null;
  is_active: boolean;
  config: Json;
  created_at: string;
  updated_at: string;
}
export type PrinterInsert = Omit<PrinterRow, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};
export type PrinterUpdate = Partial<PrinterRow>;

// ─── audit_log ────────────────────────────────────────────────────────────────
export interface AuditLogRow {
  id: string;
  store_id: string | null;
  actor: string | null;
  action: string;
  target: string | null;
  payload: Json | null;
  created_at: string;
}
export type AuditLogInsert = Omit<AuditLogRow, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};
export type AuditLogUpdate = Partial<AuditLogRow>;

// ─── order_sequences ──────────────────────────────────────────────────────────
export interface OrderSequenceRow {
  store_id: string;
  day: string;
  last_no: number;
}
export type OrderSequenceInsert = OrderSequenceRow;
export type OrderSequenceUpdate = Partial<OrderSequenceRow>;

// ─── idempotency_keys ───────────────────────────────────────────────────────────
export interface IdempotencyKeyRow {
  key: string;
  scope: string;
  created_at: string;
  expires_at: string;
}
export type IdempotencyKeyInsert = Omit<IdempotencyKeyRow, "created_at" | "expires_at"> & {
  created_at?: string;
  expires_at?: string;
};
export type IdempotencyKeyUpdate = Partial<IdempotencyKeyRow>;

// ─── Database map ────────────────────────────────────────────────────────────
export interface Database {
  public: {
    Tables: {
      stores: { Row: StoreRow; Insert: StoreInsert; Update: StoreUpdate; Relationships: [] };
      store_members: {
        Row: StoreMemberRow;
        Insert: StoreMemberInsert;
        Update: StoreMemberUpdate;
        Relationships: [];
      };
      categories: {
        Row: CategoryRow;
        Insert: CategoryInsert;
        Update: CategoryUpdate;
        Relationships: [];
      };
      products: {
        Row: ProductRow;
        Insert: ProductInsert;
        Update: ProductUpdate;
        Relationships: [];
      };
      orders: { Row: OrderRow; Insert: OrderInsert; Update: OrderUpdate; Relationships: [] };
      order_items: {
        Row: OrderItemRow;
        Insert: OrderItemInsert;
        Update: OrderItemUpdate;
        Relationships: [];
      };
      printers: {
        Row: PrinterRow;
        Insert: PrinterInsert;
        Update: PrinterUpdate;
        Relationships: [];
      };
      audit_log: {
        Row: AuditLogRow;
        Insert: AuditLogInsert;
        Update: AuditLogUpdate;
        Relationships: [];
      };
      order_sequences: {
        Row: OrderSequenceRow;
        Insert: OrderSequenceInsert;
        Update: OrderSequenceUpdate;
        Relationships: [];
      };
      idempotency_keys: {
        Row: IdempotencyKeyRow;
        Insert: IdempotencyKeyInsert;
        Update: IdempotencyKeyUpdate;
        Relationships: [];
      };
    };
    Views: {
      public_store_menu: {
        Row: { slug: string; store: Json; categories: Json };
        Relationships: [];
      };
    };
    Functions: {
      store_slug_available: { Args: { p_slug: string }; Returns: boolean };
      next_order_number: { Args: { p_store_id: string }; Returns: string };
      categories_reorder: {
        Args: { p_store_id: string; p_ids: string[] };
        Returns: CategoryRow[];
      };
      products_reorder: {
        Args: { p_store_id: string; p_ids: string[] };
        Returns: ProductRow[];
      };
      orders_create: {
        Args: {
          p_store_id: string;
          p_items: Json;
          p_customer_name?: string | null;
          p_customer_phone?: string | null;
          p_notes?: string | null;
          p_payment_method?: PaymentMethod;
        };
        Returns: OrderRow;
      };
      orders_can_transition: {
        Args: { p_from: OrderStatus; p_to: OrderStatus };
        Returns: boolean;
      };
      orders_advance_status: {
        Args: { p_order_id: string; p_next: OrderStatus };
        Returns: OrderRow;
      };
      orders_cancel: {
        Args: { p_order_id: string; p_reason?: string | null };
        Returns: OrderRow;
      };
      dashboard_summary: {
        Args: { p_store_id: string; p_range?: string };
        Returns: Json;
      };
      reports_sales_rows: {
        Args: { p_store_id: string; p_from: string; p_to: string };
        Returns: Array<{
          order_number: string;
          created_at: string;
          status: OrderStatus;
          customer_name: string | null;
          subtotal: number;
          tax_amount: number;
          total_amount: number;
          items: number;
        }>;
      };
      provision_tenant: {
        Args: {
          p_user_id: string;
          p_store_name: string;
          p_store_slug: string;
          p_owner_name?: string | null;
          p_store_upi_id?: string | null;
        };
        Returns: Json;
      };
      public_order_lookup: {
        Args: { p_slug: string; p_order_number: string };
        Returns: Json;
      };
      mark_payment_paid: {
        Args: {
          p_order_id: string;
          p_provider_payment_id: string;
          p_provider?: string;
        };
        Returns: OrderRow;
      };
      notify_order_transition: {
        Args: {
          p_order_id: string;
          p_from: OrderStatus;
          p_to: OrderStatus;
        };
        Returns: undefined;
      };
    };
    Enums: {
      order_status: OrderStatus;
      payment_status: PaymentStatus;
      payment_method: PaymentMethod;
      store_status: StoreStatus;
      member_role: StoreRole;
      printer_kind: PrinterType;
      printer_connection_status: PrinterConnectionStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
