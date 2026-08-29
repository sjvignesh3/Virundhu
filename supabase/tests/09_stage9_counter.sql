-- =============================================================================
-- 09_stage9_counter.sql — Stage 9 regression locks.
-- Verifies:
--   1. provision_tenant/5 is executable by service_role (signup fix).
--   2. NEW → PREPARING is now a legal transition (ACCEPTED column removed
--      from the live board); NEW → ACCEPTED stays legal for legacy rows.
--   3. orders_create_counter creates a COMPLETED + PAID order (history/
--      dashboard path, never the live board).
--   4. Counter totals are server-authoritative (price × qty + tax).
--   5. orders_create_counter rejects non-members (42501).
-- =============================================================================
begin;
select plan(6);

-- ── fixtures ─────────────────────────────────────────────────────────────────
insert into public.stores (id, slug, name, status, accept_orders, tax_rate) values
  ('99999999-0000-0000-0000-00000000cafe', 'stage9-cafe', 'Stage 9 Cafe', 'OPEN', true, 10)
on conflict do nothing;

insert into public.categories (id, store_id, name, is_active) values
  ('99999999-0000-0000-0000-000000000001',
   '99999999-0000-0000-0000-00000000cafe', 'cat', true)
on conflict do nothing;

insert into public.products (id, store_id, category_id, name, price, is_available) values
  ('99999999-0000-0000-0000-000000000002',
   '99999999-0000-0000-0000-00000000cafe',
   '99999999-0000-0000-0000-000000000001', 'Counter Idli', 30, true)
on conflict do nothing;

-- ── (1) signup grant restored ────────────────────────────────────────────────
select ok(
  has_function_privilege(
    'service_role',
    'public.provision_tenant(uuid, text, text, text, text)',
    'execute'
  ),
  'service_role can execute provision_tenant/5 (auth-signup EF path)'
);

-- ── (2) transition matrix (ACCEPTED fully retired as a target, 002800) ──────
select ok(
  public.orders_can_transition('NEW', 'PREPARING')
  and not public.orders_can_transition('NEW', 'ACCEPTED')
  and not public.orders_can_transition('NEW', 'COMPLETED')
  and public.orders_can_transition('ACCEPTED', 'PREPARING'),
  'NEW → PREPARING legal; ACCEPTED unreachable as target but drains to PREPARING'
);

-- ── (3)+(4) counter sale as the store owner ──────────────────────────────────
set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '99999999-aaaa-0000-0000-000000000001',
    'app_metadata', json_build_object(
      'store_ids', json_build_array('99999999-0000-0000-0000-00000000cafe'),
      'role', 'OWNER'
    )
  )::text,
  true
);

select is(
  (public.orders_create_counter(
    '99999999-0000-0000-0000-00000000cafe',
    jsonb_build_array(jsonb_build_object(
      'product_id', '99999999-0000-0000-0000-000000000002',
      'quantity',   2))
  )).status,
  'COMPLETED'::public.order_status,
  'counter order is created already COMPLETED'
);

select is(
  (select (payment_status, total_amount)::text from public.orders
    where store_id = '99999999-0000-0000-0000-00000000cafe' limit 1),
  '(PAID,66.00)',
  'counter order is PAID with server-computed total (2×30 + 10% tax = 66.00)'
);

-- Counter orders never surface on the live queue.
select is(
  (select count(*)::int from public.orders
    where store_id = '99999999-0000-0000-0000-00000000cafe'
      and status in ('NEW','ACCEPTED','PREPARING','READY')),
  0,
  'counter order is invisible to the live board'
);

-- ── (5) non-member rejected ──────────────────────────────────────────────────
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '99999999-bbbb-0000-0000-000000000002',
    'app_metadata', json_build_object('store_ids', json_build_array(), 'role', 'OWNER')
  )::text,
  true
);
select throws_ok(
  $$ select public.orders_create_counter(
       '99999999-0000-0000-0000-00000000cafe'::uuid,
       jsonb_build_array(jsonb_build_object(
         'product_id', '99999999-0000-0000-0000-000000000002',
         'quantity',   1))) $$,
  '42501',
  null,
  'orders_create_counter denies non-members'
);

select * from finish();
rollback;
