-- =============================================================================
-- 20260901000900_rls.sql
-- Purpose : enable + force RLS on every application table and install
--           tenancy-scoped policies. Public menu access is granted only via
--           the security_barrier view created in a later migration.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- STORES
-- ---------------------------------------------------------------------------
alter table public.stores enable row level security;
alter table public.stores force  row level security;

drop policy if exists stores_select_own on public.stores;
create policy stores_select_own on public.stores
  for select to authenticated
  using (auth.has_store(id));

drop policy if exists stores_update_owner on public.stores;
create policy stores_update_owner on public.stores
  for update to authenticated
  using      (auth.has_store(id) and auth.jwt_role() = 'OWNER')
  with check (auth.has_store(id) and auth.jwt_role() = 'OWNER');

-- No INSERT/DELETE policy: creation happens in auth-signup Edge Function
-- running under service_role; deletion is disallowed at the app layer.

-- ---------------------------------------------------------------------------
-- STORE_MEMBERS
-- ---------------------------------------------------------------------------
alter table public.store_members enable row level security;
alter table public.store_members force  row level security;

drop policy if exists members_select_own_store on public.store_members;
create policy members_select_own_store on public.store_members
  for select to authenticated
  using (auth.has_store(store_id));

drop policy if exists members_write_owner on public.store_members;
create policy members_write_owner on public.store_members
  for all to authenticated
  using      (auth.has_store(store_id) and auth.jwt_role() = 'OWNER')
  with check (auth.has_store(store_id) and auth.jwt_role() = 'OWNER');

-- ---------------------------------------------------------------------------
-- CATEGORIES
-- ---------------------------------------------------------------------------
alter table public.categories enable row level security;
alter table public.categories force  row level security;

drop policy if exists categories_select on public.categories;
create policy categories_select on public.categories
  for select to authenticated
  using (auth.has_store(store_id));

drop policy if exists categories_insert on public.categories;
create policy categories_insert on public.categories
  for insert to authenticated
  with check (auth.has_store(store_id));

drop policy if exists categories_update on public.categories;
create policy categories_update on public.categories
  for update to authenticated
  using      (auth.has_store(store_id))
  with check (auth.has_store(store_id));

drop policy if exists categories_delete on public.categories;
create policy categories_delete on public.categories
  for delete to authenticated
  using (auth.has_store(store_id));

-- ---------------------------------------------------------------------------
-- PRODUCTS
-- ---------------------------------------------------------------------------
alter table public.products enable row level security;
alter table public.products force  row level security;

drop policy if exists products_select on public.products;
create policy products_select on public.products
  for select to authenticated
  using (auth.has_store(store_id));

drop policy if exists products_insert on public.products;
create policy products_insert on public.products
  for insert to authenticated
  with check (auth.has_store(store_id));

drop policy if exists products_update on public.products;
create policy products_update on public.products
  for update to authenticated
  using      (auth.has_store(store_id))
  with check (auth.has_store(store_id));

drop policy if exists products_delete on public.products;
create policy products_delete on public.products
  for delete to authenticated
  using (auth.has_store(store_id));

-- ---------------------------------------------------------------------------
-- ORDERS + ORDER_ITEMS
-- Reads scoped to tenancy. Writes intentionally denied — go through RPCs.
-- ---------------------------------------------------------------------------
alter table public.orders enable row level security;
alter table public.orders force  row level security;

drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders
  for select to authenticated
  using (auth.has_store(store_id));

-- No insert/update/delete policies → PostgREST returns 401 for direct writes.
-- All mutations go through SECURITY DEFINER RPCs.

alter table public.order_items enable row level security;
alter table public.order_items force  row level security;

drop policy if exists order_items_select on public.order_items;
create policy order_items_select on public.order_items
  for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and auth.has_store(o.store_id)
    )
  );

-- ---------------------------------------------------------------------------
-- PRINTERS
-- ---------------------------------------------------------------------------
alter table public.printers enable row level security;
alter table public.printers force  row level security;

drop policy if exists printers_select on public.printers;
create policy printers_select on public.printers
  for select to authenticated
  using (auth.has_store(store_id));

drop policy if exists printers_write on public.printers;
create policy printers_write on public.printers
  for all to authenticated
  using      (auth.has_store(store_id))
  with check (auth.has_store(store_id));

-- ---------------------------------------------------------------------------
-- AUDIT_LOG — read own tenant only; no writes from application roles.
-- ---------------------------------------------------------------------------
alter table public.audit_log enable row level security;
alter table public.audit_log force  row level security;

drop policy if exists audit_select on public.audit_log;
create policy audit_select on public.audit_log
  for select to authenticated
  using (auth.has_store(store_id));

-- ---------------------------------------------------------------------------
-- ORDER_SEQUENCES — no direct access; managed by next_order_number().
-- ---------------------------------------------------------------------------
alter table public.order_sequences enable row level security;
alter table public.order_sequences force  row level security;
-- No policies → invisible to authenticated + anon. DEFINER RPCs bypass.

-- ---------------------------------------------------------------------------
-- Baseline grants: revoke everything from anon, then hand out only what each
-- role legitimately needs.
-- ---------------------------------------------------------------------------
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;

grant usage on schema public to anon, authenticated;

-- authenticated may SELECT everywhere (subject to RLS), and DML on the
-- non-order tables (subject to RLS). Order tables intentionally omit DML.
grant select                         on all tables in schema public to authenticated;
grant insert, update, delete on
  public.stores, public.categories, public.products, public.printers,
  public.store_members
  to authenticated;

grant usage, select on all sequences in schema public to authenticated;
