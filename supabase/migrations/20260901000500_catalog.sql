-- =============================================================================
-- 20260901000500_catalog.sql
-- Purpose : categories + products (the sellable menu).
-- =============================================================================

create table if not exists public.categories (
  id           uuid primary key default extensions.gen_random_uuid(),
  store_id     uuid not null references public.stores(id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 80),
  sort_order   integer not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (store_id, name)
);

create index if not exists categories_store_sort_idx
  on public.categories (store_id, sort_order, name);

drop trigger if exists tg_categories_updated_at on public.categories;
create trigger tg_categories_updated_at
  before update on public.categories
  for each row execute function public.tg_set_updated_at();

comment on table public.categories is
  'Menu categories, scoped per store. Sort order is client-controlled.';

-- ---------------------------------------------------------------------------
create table if not exists public.products (
  id             uuid primary key default extensions.gen_random_uuid(),
  store_id       uuid not null references public.stores(id) on delete cascade,
  category_id    uuid references public.categories(id) on delete set null,
  name           text not null check (char_length(name) between 1 and 120),
  description    text,
  price          numeric(12,2) not null check (price >= 0),
  image_url      text,
  is_active      boolean not null default true,
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- One index for the owner list (all products by store, sorted) and one for
-- the public menu query which filters by active + category.
create index if not exists products_store_sort_idx
  on public.products (store_id, sort_order, name);

create index if not exists products_store_active_category_idx
  on public.products (store_id, category_id)
  where is_active = true;

drop trigger if exists tg_products_updated_at on public.products;
create trigger tg_products_updated_at
  before update on public.products
  for each row execute function public.tg_set_updated_at();

comment on table public.products is
  'Sellable items. Price is authoritative; client-supplied price on order is ignored.';
