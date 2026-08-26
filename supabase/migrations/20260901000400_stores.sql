-- =============================================================================
-- 20260901000400_stores.sql
-- Purpose : tenant root table + membership.
-- =============================================================================

create table if not exists public.stores (
  id           uuid primary key default extensions.gen_random_uuid(),
  slug         extensions.citext not null unique,
  name         text not null check (char_length(name) between 1 and 120),
  status       public.store_status not null default 'OPEN',
  currency     char(3) not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  tax_rate     numeric(5,2) not null default 0 check (tax_rate between 0 and 100),
  logo_url     text,
  address      text,
  phone        text,
  settings     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint stores_slug_format check (public.is_valid_slug(slug::text))
);

create index if not exists stores_status_idx on public.stores (status)
  where status = 'OPEN';

drop trigger if exists tg_stores_updated_at on public.stores;
create trigger tg_stores_updated_at
  before update on public.stores
  for each row execute function public.tg_set_updated_at();

comment on table public.stores is
  'Root tenant row. One row per merchant. Slug is public menu URL segment.';

-- ---------------------------------------------------------------------------
-- Membership: joins auth.users to stores with a role.
-- We do NOT foreign-key to auth.users directly in a migration (Supabase best
-- practice) — the reference is soft, enforced by RLS + the signup RPC.
-- ---------------------------------------------------------------------------
create table if not exists public.store_members (
  store_id     uuid not null references public.stores(id) on delete cascade,
  user_id      uuid not null,
  role         public.member_role not null default 'OWNER',
  created_at   timestamptz not null default now(),
  primary key (store_id, user_id)
);

create index if not exists store_members_user_idx
  on public.store_members (user_id);

comment on table public.store_members is
  'Owner/staff membership. user_id references auth.users(id) but soft-linked.';
