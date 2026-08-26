-- =============================================================================
-- 04_public_read_paths.sql — Stage 4 anonymous read surface.
-- Verifies:
--   1. anon can SELECT `public_store_menu` for OPEN stores.
--   2. anon CANNOT SELECT the underlying `orders` table.
--   3. `public_order_lookup(slug, order_number)` returns the receipt shape
--      for a valid tuple.
--   4. `public_order_lookup` raises ORDER_NOT_FOUND for unknown order_number.
--   5. `public_order_lookup` raises STORE_NOT_FOUND for CLOSED store.
-- =============================================================================
begin;
select plan(7);

-- ── Fixture ────────────────────────────────────────────────────────────────
insert into public.stores (id, slug, name, status, accept_orders, tax_rate) values
  ('dddd4444-4444-4444-4444-000000000001', 'stage4-open',   'Stage4 Open',   'OPEN',   true, 0.00),
  ('dddd4444-4444-4444-4444-000000000002', 'stage4-closed', 'Stage4 Closed', 'CLOSED', true, 0.00)
on conflict do nothing;

insert into public.categories (id, store_id, name) values
  ('dddd4444-cccc-0000-0000-000000000001', 'dddd4444-4444-4444-4444-000000000001', 'Snacks')
on conflict do nothing;

insert into public.products (id, store_id, category_id, name, price, unit, is_available) values
  ('dddd4444-cccc-0000-0000-000000000010',
   'dddd4444-4444-4444-4444-000000000001',
   'dddd4444-cccc-0000-0000-000000000001',
   'Vada', 20.00, 'piece', true)
on conflict do nothing;

-- A finished order to look up.
insert into public.orders (
  id, store_id, order_number, status, payment_status,
  customer_name, subtotal, tax_amount, total_amount
) values (
  'dddd4444-0000-0000-0000-00000000f00d',
  'dddd4444-4444-4444-4444-000000000001',
  'A-20260901-0001',
  'READY', 'PAID',
  'Test Cust', 40.00, 0.00, 40.00
) on conflict do nothing;

insert into public.order_items (order_id, product_id, product_name, unit_price, quantity) values
  ('dddd4444-0000-0000-0000-00000000f00d',
   'dddd4444-cccc-0000-0000-000000000010',
   'Vada', 20.00, 2)
on conflict do nothing;

-- ── Switch to anon role ────────────────────────────────────────────────────
set local role anon;

-- (1) anon CAN read public_store_menu for OPEN store.
select ok(
  (select count(*) from public.public_store_menu where slug = 'stage4-open') = 1,
  'anon can SELECT public_store_menu for OPEN store'
);

-- (2) anon CANNOT read the underlying orders table.
select throws_ok(
  $$ select id from public.orders where order_number = 'A-20260901-0001' $$,
  '42501',
  null,
  'anon SELECT on orders is denied by RLS'
);

-- (3) anon CAN call public_order_lookup on a known order.
select ok(
  (public.public_order_lookup('stage4-open', 'A-20260901-0001')->>'orderNumber')
    = 'A-20260901-0001',
  'public_order_lookup returns matching order'
);

select ok(
  jsonb_typeof(public.public_order_lookup('stage4-open', 'A-20260901-0001')->'items') = 'array',
  'public_order_lookup includes items array'
);

select ok(
  (public.public_order_lookup('stage4-open', 'A-20260901-0001')->'items'->0->>'name') = 'Vada',
  'items include product_name snapshot'
);

-- (4) unknown order raises ORDER_NOT_FOUND.
select throws_ok(
  $$ select public.public_order_lookup('stage4-open', 'Z-99999999-9999') $$,
  'P0002',
  'ORDER_NOT_FOUND',
  'unknown order_number raises ORDER_NOT_FOUND'
);

-- (5) closed store raises STORE_NOT_FOUND (public_order_lookup filters by status='OPEN').
select throws_ok(
  $$ select public.public_order_lookup('stage4-closed', 'A-20260901-0001') $$,
  'P0002',
  'STORE_NOT_FOUND',
  'CLOSED store raises STORE_NOT_FOUND'
);

select * from finish();
rollback;
