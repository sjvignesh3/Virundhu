-- =============================================================================
-- 20260901001900_schema_align_contract.sql
--
-- Purpose : align the Postgres schema with @virundhu/shared (the frozen
--           contract per Plan §Guiding principles). Stage 1 shipped a minimal
--           schema (order_no, total, tax, sort_order, is_active, name_snapshot,
--           placed_at); this migration widens it to the DTO shape without
--           dropping data.
--
-- Strategy: rename columns in place; add new columns with sensible defaults;
--           update dependent RPCs, view, and indexes downstream (later files).
--
-- Idempotency: each ALTER is guarded so re-runs on a partially migrated DB
--              are safe.
-- =============================================================================

-- ─── stores ───────────────────────────────────────────────────────────────────
-- Widen with contract-mandated fields. `settings` jsonb stays for now; new
-- columns become the canonical settings surface.
alter table public.stores
  add column if not exists tamil_name                     text,
  add column if not exists description                    text,
  add column if not exists image_url                      text,
  add column if not exists default_language               text
    not null default 'en'
    check (default_language in ('en', 'ta')),
  add column if not exists show_tamil_names               boolean not null default false,
  add column if not exists show_unavailable               boolean not null default true,
  add column if not exists accept_orders                  boolean not null default true,
  add column if not exists minimum_order_value            numeric(12,2) not null default 0
    check (minimum_order_value >= 0),
  add column if not exists estimated_preparation_minutes  integer not null default 15
    check (estimated_preparation_minutes between 0 and 600);

-- ─── categories ───────────────────────────────────────────────────────────────
-- Rename sort_order → display_order to match DTO. Add tamil_name + description.
do $$ begin
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='categories' and column_name='sort_order')
     and not exists (select 1 from information_schema.columns
                     where table_schema='public' and table_name='categories' and column_name='display_order')
  then
    alter table public.categories rename column sort_order to display_order;
  end if;
end $$;

alter table public.categories
  add column if not exists tamil_name  text,
  add column if not exists description text;

-- Re-create the sort index under the new column name.
drop index if exists public.categories_store_sort_idx;
create index if not exists categories_store_display_idx
  on public.categories (store_id, display_order, name);

-- ─── products ─────────────────────────────────────────────────────────────────
-- Rename sort_order → display_order, is_active → is_available. Add contract
-- fields: unit, tamil_name, tamil_description, stock_quantity, low_stock_threshold.
do $$ begin
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='products' and column_name='sort_order')
     and not exists (select 1 from information_schema.columns
                     where table_schema='public' and table_name='products' and column_name='display_order')
  then
    alter table public.products rename column sort_order to display_order;
  end if;

  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='products' and column_name='is_active')
     and not exists (select 1 from information_schema.columns
                     where table_schema='public' and table_name='products' and column_name='is_available')
  then
    alter table public.products rename column is_active to is_available;
  end if;
end $$;

alter table public.products
  add column if not exists tamil_name           text,
  add column if not exists tamil_description    text,
  add column if not exists unit                 text not null default 'plate'
    check (unit in ('plate','piece','cup','glass','bottle','kg','g')),
  add column if not exists stock_quantity       numeric(12,2),
  add column if not exists low_stock_threshold  numeric(12,2);

-- Re-create indexes under new column names.
drop index if exists public.products_store_sort_idx;
drop index if exists public.products_store_active_category_idx;

create index if not exists products_store_display_idx
  on public.products (store_id, display_order, name);
create index if not exists products_store_available_category_idx
  on public.products (store_id, category_id)
  where is_available = true;

-- ─── orders ───────────────────────────────────────────────────────────────────
-- Rename order_no → order_number, tax → tax_amount, total → total_amount,
-- placed_at → order_placed_at (or drop; created_at already exists).
-- Add discount_amount.
do $$ begin
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='orders' and column_name='order_no')
     and not exists (select 1 from information_schema.columns
                     where table_schema='public' and table_name='orders' and column_name='order_number')
  then
    alter table public.orders rename column order_no to order_number;
  end if;

  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='orders' and column_name='tax')
     and not exists (select 1 from information_schema.columns
                     where table_schema='public' and table_name='orders' and column_name='tax_amount')
  then
    alter table public.orders rename column tax to tax_amount;
  end if;

  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='orders' and column_name='total')
     and not exists (select 1 from information_schema.columns
                     where table_schema='public' and table_name='orders' and column_name='total_amount')
  then
    alter table public.orders rename column total to total_amount;
  end if;
end $$;

alter table public.orders
  add column if not exists discount_amount numeric(12,2) not null default 0
    check (discount_amount >= 0);

-- The check constraint used the old names; recreate under new ones (drop the
-- old constraint by its known name).
alter table public.orders
  drop constraint if exists orders_total_matches;
alter table public.orders
  add constraint orders_total_matches
    check (total_amount = round(subtotal + tax_amount - discount_amount, 2));

-- Rebuild indexes that mentioned old columns.
drop index if exists public.orders_live_idx;
drop index if exists public.orders_history_idx;
drop index if exists public.orders_search_idx;

create index if not exists orders_live_idx
  on public.orders (store_id, created_at desc)
  where status in ('NEW', 'ACCEPTED', 'PREPARING', 'READY');

create index if not exists orders_history_idx
  on public.orders (store_id, created_at desc);

create index if not exists orders_search_idx
  on public.orders using gin (
    to_tsvector('simple', coalesce(order_number,'') || ' ' || coalesce(customer_name,''))
  );

-- ─── order_items ──────────────────────────────────────────────────────────────
-- Rename name_snapshot → product_name; add product_tamil_name and unit
-- (frozen at insert like unit_price).
do $$ begin
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='order_items' and column_name='name_snapshot')
     and not exists (select 1 from information_schema.columns
                     where table_schema='public' and table_name='order_items' and column_name='product_name')
  then
    alter table public.order_items rename column name_snapshot to product_name;
  end if;
end $$;

alter table public.order_items
  add column if not exists product_tamil_name text,
  add column if not exists unit               text not null default 'plate'
    check (unit in ('plate','piece','cup','glass','bottle','kg','g'));

-- ─── printers ─────────────────────────────────────────────────────────────────
-- Add connection_status enum column + `type` alias so the DTO field matches.
-- Rename `kind` → `type` for contract parity.
do $$ begin
  if not exists (select 1 from pg_type where typname = 'printer_connection_status') then
    create type public.printer_connection_status as enum
      ('CONNECTED', 'DISCONNECTED', 'UNKNOWN');
  end if;

  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='printers' and column_name='kind')
     and not exists (select 1 from information_schema.columns
                     where table_schema='public' and table_name='printers' and column_name='type')
  then
    alter table public.printers rename column kind to type;
  end if;
end $$;

alter table public.printers
  add column if not exists connection_status public.printer_connection_status
    not null default 'UNKNOWN';

-- =============================================================================
-- Note: the RPCs (orders_create, orders_advance_status, dashboard_summary,
-- reports_sales_rows, view public_store_menu) referenced the old column names.
-- The immediately following migrations replace those functions in place so the
-- pg_dump of the final schema is coherent.
-- =============================================================================
