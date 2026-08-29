-- =============================================================================
-- 05_stage5_payments_notify.sql — Stage 5 payment idempotency + notify safety.
-- Verifies:
--   1. mark_payment_paid flips payment_status to PAID and stamps the anchor.
--   2. mark_payment_paid is idempotent — a replayed provider id is a no-op.
--   3. mark_payment_paid rejects an unknown order (ORDER_NOT_FOUND).
--   4. mark_payment_paid rejects a blank provider payment id (22023).
--   5. notify_order_transition is a safe no-op when app.edge_url is unset.
--   6. orders_advance_status still succeeds (fan-out never blocks the write).
--   7. idempotency_keys is invisible to the anon role (RLS, no policies).
-- =============================================================================
begin;
select plan(7);

-- ── Fixture ──────────────────────────────────────────────────────────────────
insert into public.stores (id, slug, name, status, accept_orders, tax_rate) values
  ('eeee5555-5555-5555-5555-000000000001', 'stage5-cafe', 'Stage5 Cafe', 'OPEN', true, 0.00)
on conflict do nothing;

insert into public.categories (id, store_id, name) values
  ('eeee5555-cccc-0000-0000-000000000001', 'eeee5555-5555-5555-5555-000000000001', 'C')
on conflict do nothing;

insert into public.products (id, store_id, category_id, name, price, unit, is_available) values
  ('eeee5555-cccc-0000-0000-000000000010',
   'eeee5555-5555-5555-5555-000000000001',
   'eeee5555-cccc-0000-0000-000000000001',
   'Idli', 30.00, 'plate', true)
on conflict do nothing;

insert into public.orders (
  id, store_id, order_number, status, payment_status,
  customer_name, customer_phone, subtotal, tax_amount, total_amount
) values (
  'eeee5555-0000-0000-0000-00000000f00d',
  'eeee5555-5555-5555-5555-000000000001',
  'A-20260901-0001',
  'READY', 'PENDING',
  'Pay Cust', '+919000000000', 60.00, 0.00, 60.00
) on conflict do nothing;

-- ── (1) capture flips to PAID ───────────────────────────────────────────────
select is(
  (public.mark_payment_paid(
    'eeee5555-0000-0000-0000-00000000f00d', 'pay_TESTCAPTURE01', 'razorpay'
  )).payment_status,
  'PAID'::public.payment_status,
  'mark_payment_paid sets payment_status = PAID'
);

-- ── (2) idempotent replay returns the same order, no error ──────────────────
select is(
  (public.mark_payment_paid(
    'eeee5555-0000-0000-0000-00000000f00d', 'pay_TESTCAPTURE01', 'razorpay'
  )).provider_payment_id,
  'pay_TESTCAPTURE01',
  'replayed provider_payment_id is idempotent (no double-apply)'
);

-- ── (3) unknown order raises ORDER_NOT_FOUND ────────────────────────────────
select throws_ok(
  $$ select public.mark_payment_paid(
       '00000000-0000-0000-0000-0000deadbeef'::uuid, 'pay_NEWID_UNKNOWN', 'razorpay') $$,
  'P0002',
  'ORDER_NOT_FOUND',
  'unknown order raises ORDER_NOT_FOUND'
);

-- ── (4) blank provider id rejected ──────────────────────────────────────────
select throws_ok(
  $$ select public.mark_payment_paid(
       'eeee5555-0000-0000-0000-00000000f00d'::uuid, 'x', 'razorpay') $$,
  '22023',
  'INVALID_PROVIDER_PAYMENT_ID',
  'too-short provider_payment_id rejected'
);

-- ── (5) notify_order_transition is a no-op when unconfigured ────────────────
-- app.edge_url is unset in the test DB → function must return without error.
select lives_ok(
  $$ select public.notify_order_transition(
       'eeee5555-0000-0000-0000-00000000f00d'::uuid,
       'READY'::public.order_status, 'COMPLETED'::public.order_status) $$,
  'notify_order_transition is a safe no-op when app.edge_url is unset'
);

-- ── (6) advance_status still works end-to-end (fan-out non-blocking) ────────
set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', 'eeee5555-aaaa-0000-0000-000000000001',
    'app_metadata', json_build_object(
      'store_ids', json_build_array('eeee5555-5555-5555-5555-000000000001'),
      'role', 'OWNER'
    )
  )::text,
  true
);
select is(
  (public.orders_advance_status(
    'eeee5555-0000-0000-0000-00000000f00d', 'COMPLETED'
  )).status,
  'COMPLETED'::public.order_status,
  'orders_advance_status completes despite trailing notify fan-out'
);

-- ── (7) idempotency_keys invisible to anon (grants revoked entirely) ────────
set local role anon;
select throws_ok(
  $$ select count(*) from public.idempotency_keys $$,
  '42501',
  null,
  'anon cannot read idempotency_keys (permission denied)'
);

select * from finish();
rollback;
