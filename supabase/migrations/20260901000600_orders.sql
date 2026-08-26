-- =============================================================================
-- 20260901000600_orders.sql
-- Purpose : orders + order_items + per-store daily sequence for order numbers.
-- =============================================================================

-- Per-store, per-day counter. Enables deterministic, human-friendly order
-- numbers ("A-20260901-0007") without relying on a global sequence.
create table if not exists public.order_sequences (
  store_id   uuid not null references public.stores(id) on delete cascade,
  day        date not null,
  last_no    integer not null default 0,
  primary key (store_id, day)
);

comment on table public.order_sequences is
  'Per-store daily counter used by next_order_number(). One row per store per day.';

-- ---------------------------------------------------------------------------
create table if not exists public.orders (
  id                uuid primary key default extensions.gen_random_uuid(),
  store_id          uuid not null references public.stores(id) on delete cascade,
  order_no          text not null,
  status            public.order_status  not null default 'NEW',
  payment_status    public.payment_status not null default 'PENDING',
  payment_method    public.payment_method,
  customer_name     text,
  customer_phone    text,
  notes             text,
  subtotal          numeric(12,2) not null check (subtotal >= 0),
  tax               numeric(12,2) not null default 0 check (tax >= 0),
  total             numeric(12,2) not null check (total >= 0),
  placed_at         timestamptz not null default now(),
  completed_at      timestamptz,
  cancelled_at      timestamptz,
  cancel_reason     text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (store_id, order_no),
  constraint orders_total_matches
    check (total = round(subtotal + tax, 2))
);

-- Live queue: (store_id, status) partial index is the hottest read path.
create index if not exists orders_live_idx
  on public.orders (store_id, placed_at desc)
  where status in ('NEW', 'ACCEPTED', 'PREPARING', 'READY');

-- History range scans by date.
create index if not exists orders_history_idx
  on public.orders (store_id, placed_at desc);

-- Free-text search on order_no / customer_name for the history page.
create index if not exists orders_search_idx
  on public.orders using gin (
    to_tsvector('simple', coalesce(order_no,'') || ' ' || coalesce(customer_name,''))
  );

drop trigger if exists tg_orders_updated_at on public.orders;
create trigger tg_orders_updated_at
  before update on public.orders
  for each row execute function public.tg_set_updated_at();

comment on table public.orders is
  'Order header. Mutations go through orders_* RPCs — direct updates blocked by RLS.';

-- ---------------------------------------------------------------------------
create table if not exists public.order_items (
  id            uuid primary key default extensions.gen_random_uuid(),
  order_id      uuid not null references public.orders(id) on delete cascade,
  product_id    uuid not null references public.products(id) on delete restrict,
  name_snapshot text not null,       -- immortalises product name at time of sale
  unit_price    numeric(12,2) not null check (unit_price >= 0),
  quantity      integer not null check (quantity > 0),
  line_total    numeric(12,2) generated always as (round(unit_price * quantity, 2)) stored,
  notes         text,
  created_at    timestamptz not null default now()
);

create index if not exists order_items_order_idx
  on public.order_items (order_id);

comment on table public.order_items is
  'Order lines. name_snapshot + unit_price frozen at insert to survive product edits.';
