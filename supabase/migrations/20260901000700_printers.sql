-- =============================================================================
-- 20260901000700_printers.sql
-- Purpose : printer registrations. Currently just metadata — no physical driver.
-- =============================================================================

create table if not exists public.printers (
  id           uuid primary key default extensions.gen_random_uuid(),
  store_id     uuid not null references public.stores(id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 80),
  kind         public.printer_kind not null default 'THERMAL',
  address      text,                     -- IP / bluetooth id / URL
  is_active    boolean not null default true,
  config       jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (store_id, name)
);

create index if not exists printers_store_idx on public.printers (store_id);

drop trigger if exists tg_printers_updated_at on public.printers;
create trigger tg_printers_updated_at
  before update on public.printers
  for each row execute function public.tg_set_updated_at();
