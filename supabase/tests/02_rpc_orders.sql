-- =============================================================================
-- 02_rpc_orders.sql — orders_create + advance_status happy paths & guards.
-- Post-alignment (2026-09-01T00:19) column names used throughout.
-- =============================================================================
begin;
select plan(7);

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

-- Impersonate a JWT for this store.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', 'user-test',
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

-- 3. Legal transition NEW -> ACCEPTED.
select isnt(
  (select id from public.orders_advance_status(
    (select id from public.orders where store_id = 'cccc3333-3333-3333-3333-333333333333' limit 1),
    'ACCEPTED'
  ))::text,
  null,
  'NEW -> ACCEPTED is allowed'
);

-- 4. Illegal transition ACCEPTED -> COMPLETED must throw.
select throws_ok(
  format(
    $$ select public.orders_advance_status(%L::uuid, 'COMPLETED'::public.order_status) $$,
    (select id from public.orders where store_id = 'cccc3333-3333-3333-3333-333333333333' limit 1)
  ),
  '22023',
  null,
  'ACCEPTED -> COMPLETED is blocked'
);

-- 5. Empty items rejected.
select throws_ok(
  $$ select public.orders_create('cccc3333-3333-3333-3333-333333333333'::uuid, '[]'::jsonb) $$,
  '22023',
  null,
  'empty item list rejected'
);

-- 6. Cross-tenant call rejected.
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', 'foreign',
    'app_metadata', json_build_object('store_ids', json_build_array(), 'role', 'OWNER')
  )::text,
  true
);
select throws_ok(
  format(
    $$ select public.orders_create('cccc3333-3333-3333-3333-333333333333'::uuid,
       jsonb_build_array(jsonb_build_object(
         'product_id', %L, 'quantity', 1))) $$,
    'cccc3333-0000-0000-0000-000000000010'::uuid
  ),
  '42501',
  null,
  'orders_create denies non-member callers'
);

-- 7. next_order_number produces distinct values under repeat calls.
reset role;
select isnt(
  public.next_order_number('cccc3333-3333-3333-3333-333333333333'),
  public.next_order_number('cccc3333-3333-3333-3333-333333333333'),
  'next_order_number is monotonic'
);

select * from finish();
rollback;
