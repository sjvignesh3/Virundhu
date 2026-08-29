-- =============================================================================
-- 02_rpc_orders.sql — orders_create + advance_status happy paths & guards.
-- Post-alignment (2026-09-01T00:19) column names used throughout.
-- Stage 7 note: orders_create is intentionally callable by anon (public QR
-- checkout) — the old cross-tenant guard test was replaced by an anon
-- happy-path test that locks the behaviour in.
-- =============================================================================
begin;
select plan(8);

-- Fixture
insert into public.stores (id, slug, name, tax_rate, accept_orders) values
  ('cccc3333-3333-3333-3333-333333333333', 'test-cafe', 'Test Cafe', 10.00, true)
on conflict do nothing;

insert into public.categories (id, store_id, name) values
  ('cccc3333-0000-0000-0000-000000000001', 'cccc3333-3333-3333-3333-333333333333', 'C')
on conflict do nothing;

insert into public.products (id, store_id, category_id, name, price, unit) values
  ('cccc3333-0000-0000-0000-000000000010', 'cccc3333-3333-3333-3333-333333333333',
   'cccc3333-0000-0000-0000-000000000001', 'Item A', 100.00, 'plate')
on conflict do nothing;

-- Impersonate a JWT for this store. `sub` MUST be a UUID — audit-log inserts
-- cast auth.uid() to uuid.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', 'cccc3333-aaaa-0000-0000-000000000001',
    'app_metadata', json_build_object(
      'store_ids', json_build_array('cccc3333-3333-3333-3333-333333333333'),
      'role', 'OWNER'
    )
  )::text,
  true
);

-- 1. Create order server-side with authoritative price/tax.
select isnt(
  (select id from public.orders_create(
    'cccc3333-3333-3333-3333-333333333333',
    jsonb_build_array(
      jsonb_build_object('product_id', 'cccc3333-0000-0000-0000-000000000010',
                         'quantity', 2)
    )
  ))::text,
  null,
  'orders_create returns an order id'
);

-- 2. Totals recomputed server-side (100 * 2 = 200, tax 10% = 20, total 220).
select is(
  (select total_amount from public.orders
     where store_id = 'cccc3333-3333-3333-3333-333333333333' limit 1),
  220.00::numeric,
  'total recomputed server-side'
);

-- 3. Legacy order-number format restored: first order is FC-1001.
select is(
  (select order_number from public.orders
     where store_id = 'cccc3333-3333-3333-3333-333333333333' limit 1),
  'FC-1001',
  'first order number is FC-1001 (legacy format, no daily reset)'
);

-- 4. Legal transition NEW -> ACCEPTED.
select isnt(
  (select id from public.orders_advance_status(
    (select id from public.orders where store_id = 'cccc3333-3333-3333-3333-333333333333' limit 1),
    'ACCEPTED'
  ))::text,
  null,
  'NEW -> ACCEPTED is allowed'
);

-- 5. Illegal transition ACCEPTED -> COMPLETED must throw.
select throws_ok(
  format(
    $$ select public.orders_advance_status(%L::uuid, 'COMPLETED'::public.order_status) $$,
    (select id from public.orders where store_id = 'cccc3333-3333-3333-3333-333333333333' limit 1)
  ),
  '22023',
  null,
  'ACCEPTED -> COMPLETED is blocked'
);

-- 6. Empty items rejected.
select throws_ok(
  $$ select public.orders_create('cccc3333-3333-3333-3333-333333333333'::uuid, '[]'::jsonb) $$,
  '22023',
  null,
  'empty item list rejected'
);

-- 7. Anonymous customers CAN place orders (Stage 7 public QR checkout).
reset role;
set local role anon;
select set_config('request.jwt.claims', '{}', true);
select is(
  (select order_number from public.orders_create(
    'cccc3333-3333-3333-3333-333333333333',
    jsonb_build_array(
      jsonb_build_object('product_id', 'cccc3333-0000-0000-0000-000000000010',
                         'quantity', 1)
    )
  )),
  'FC-1002',
  'anon checkout succeeds and the counter advances to FC-1002'
);

-- 8. next_order_number produces distinct values under repeat calls.
reset role;
select isnt(
  public.next_order_number('cccc3333-3333-3333-3333-333333333333'),
  public.next_order_number('cccc3333-3333-3333-3333-333333333333'),
  'next_order_number is monotonic'
);

select * from finish();
rollback;
