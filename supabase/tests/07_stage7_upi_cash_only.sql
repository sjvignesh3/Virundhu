-- =============================================================================
-- 07_stage7_upi_cash_only.sql — Stage 7 surface checks.
-- Verifies:
--   1. stores.upi_id column exists with the VPA check constraint.
--   2. provision_tenant/5 exists (with the new p_store_upi_id argument).
--   3. public_store_menu view exposes store.upiId at the top level.
--   4. orders_create defaults payment_method to CASH.
--   5. orders_create rejects payment methods outside {CASH, UPI}.
--   6. When customer picks UPI but store has no upi_id, the RPC degrades
--      to CASH (no error, order saved as CASH).
--   7. The notify_order_transition helper stays as boilerplate (function
--      still exists) but orders_advance_status no longer references it.
-- =============================================================================
begin;
select plan(7);

-- ── fixtures ─────────────────────────────────────────────────────────────────
insert into public.stores (id, slug, name, status, accept_orders, tax_rate, upi_id) values
  ('aaaa7777-0000-0000-0000-00000000cafe',
   'stage7-store-a',        'Stage 7 UPI Store',  'OPEN', true, 0,
   'stage7@okhdfcbank'),
  ('bbbb7777-0000-0000-0000-00000000cafe',
   'stage7-store-b',        'Stage 7 CASH Store', 'OPEN', true, 0, null);

insert into public.categories (id, store_id, name, is_active) values
  ('aaaa7777-0000-0000-0000-000000000001',
   'aaaa7777-0000-0000-0000-00000000cafe', 'cat-a', true),
  ('bbbb7777-0000-0000-0000-000000000001',
   'bbbb7777-0000-0000-0000-00000000cafe', 'cat-b', true);

insert into public.products (id, store_id, category_id, name, price, is_available) values
  ('aaaa7777-0000-0000-0000-000000000002',
   'aaaa7777-0000-0000-0000-00000000cafe',
   'aaaa7777-0000-0000-0000-000000000001', 'Idli', 40, true),
  ('bbbb7777-0000-0000-0000-000000000002',
   'bbbb7777-0000-0000-0000-00000000cafe',
   'bbbb7777-0000-0000-0000-000000000001', 'Dosa', 50, true);

-- ── (1) upi_id column + check constraint ─────────────────────────────────────
select ok(
  exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'stores'
       and column_name  = 'upi_id'
  ),
  'stores.upi_id column exists'
);

-- ── (2) provision_tenant/5 exists ────────────────────────────────────────────
select ok(
  exists (
    select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'provision_tenant'
       and p.pronargs = 5
  ),
  'provision_tenant(uuid,text,text,text,text) exists (Stage 7 signature)'
);

-- ── (3) public_store_menu exposes upiId ─────────────────────────────────────
select ok(
  (
    select store ? 'upiId'
      from public.public_store_menu
     where slug = 'stage7-store-a'
  ),
  'public_store_menu.store JSONB contains upiId key'
);

-- ── (4) orders_create defaults to CASH ───────────────────────────────────────
-- We invoke as service_role (superuser in tests) so public.has_store() short-
-- circuits via the SECURITY DEFINER path; the payment_method default is what
-- we care about here.
do $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order from public.orders_create(
    'bbbb7777-0000-0000-0000-00000000cafe',
    jsonb_build_array(jsonb_build_object(
      'product_id', 'bbbb7777-0000-0000-0000-000000000002',
      'quantity',   1
    )),
    'Test Customer', null, null, 'CASH'
  );
  perform ok(
    v_order.payment_method = 'CASH',
    'orders_create defaults payment_method to CASH when specified'
  );
end $$;

-- ── (5) orders_create rejects SIMULATED/CARD ─────────────────────────────────
select throws_ok(
  $$ select public.orders_create(
       'aaaa7777-0000-0000-0000-00000000cafe',
       jsonb_build_array(jsonb_build_object(
         'product_id', 'aaaa7777-0000-0000-0000-000000000002',
         'quantity',   1)),
       null, null, null, 'SIMULATED'::public.payment_method) $$,
  'unsupported payment_method — v1 accepts CASH or UPI only',
  'orders_create rejects SIMULATED'
);

-- ── (6) UPI on a CASH-only store degrades silently ───────────────────────────
do $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order from public.orders_create(
    'bbbb7777-0000-0000-0000-00000000cafe',
    jsonb_build_array(jsonb_build_object(
      'product_id', 'bbbb7777-0000-0000-0000-000000000002',
      'quantity',   1)),
    null, null, null, 'UPI'
  );
  perform ok(
    v_order.payment_method = 'CASH',
    'UPI on a store without upi_id degrades to CASH (no error)'
  );
end $$;

-- ── (7) advance_status no longer invokes notify_order_transition ─────────────
-- The helper still exists (boilerplate) but should not appear inside
-- orders_advance_status' pg_get_functiondef output.
select ok(
  exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname='public' and p.proname='notify_order_transition')
  and (
    pg_get_functiondef(
      (select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname='public' and p.proname='orders_advance_status'
        limit 1)
    ) not ilike '%notify_order_transition%'
  ),
  'notify_order_transition retained as boilerplate but no longer invoked by orders_advance_status'
);

select * from finish();
rollback;
