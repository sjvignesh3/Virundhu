-- =============================================================================
-- 08_stage8_fixes.sql — audit-fix regression locks (migration 002600).
-- Verifies:
--   1. `orders` is in the supabase_realtime publication (live board events).
--   2. next_order_number restores the FC-1001 legacy format.
--   3. dashboard_summary counts PLACED orders (not just completed) and
--      exposes the active/completed split.
--   4. dashboard_summary carries the menu-health block.
--   5. store_daily_metrics_v is actually readable by authenticated.
--   6. notify_order_transition body references net.http_post (valid pg_net
--      schema), not the broken extensions.net.http_post.
-- =============================================================================
begin;
select plan(7);

-- ── fixtures ─────────────────────────────────────────────────────────────────
insert into public.stores (id, slug, name, status, accept_orders, tax_rate) values
  ('ffff8888-0000-0000-0000-00000000cafe', 'stage8-cafe', 'Stage 8 Cafe', 'OPEN', true, 0)
on conflict do nothing;

insert into public.categories (id, store_id, name, is_active) values
  ('ffff8888-0000-0000-0000-000000000001',
   'ffff8888-0000-0000-0000-00000000cafe', 'cat', true)
on conflict do nothing;

insert into public.products (id, store_id, category_id, name, price, is_available) values
  ('ffff8888-0000-0000-0000-000000000002',
   'ffff8888-0000-0000-0000-00000000cafe',
   'ffff8888-0000-0000-0000-000000000001', 'Vada', 40, true)
on conflict do nothing;

-- ── (1) realtime publication ─────────────────────────────────────────────────
select ok(
  exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'orders'
  ),
  'orders is in the supabase_realtime publication'
);

-- ── (2) FC- order numbers ────────────────────────────────────────────────────
select is(
  public.next_order_number('ffff8888-0000-0000-0000-00000000cafe'),
  'FC-1001',
  'first allocated order number is FC-1001'
);

-- ── (3) dashboard counts placed orders ───────────────────────────────────────
-- Place ONE order (status NEW) and assert it shows up in orderCount while
-- completedCount stays 0 — the pre-fix version returned 0 for both.
select lives_ok(
  $$ select public.orders_create(
       'ffff8888-0000-0000-0000-00000000cafe',
       jsonb_build_array(jsonb_build_object(
         'product_id', 'ffff8888-0000-0000-0000-000000000002',
         'quantity',   1))) $$,
  'fixture order placed'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', 'ffff8888-aaaa-0000-0000-000000000001',
    'app_metadata', json_build_object(
      'store_ids', json_build_array('ffff8888-0000-0000-0000-00000000cafe'),
      'role', 'OWNER'
    )
  )::text,
  true
);

select is(
  (
    select (s->>'orderCount')::int * 10 + (s->>'completedCount')::int
      from public.dashboard_summary('ffff8888-0000-0000-0000-00000000cafe', 'today') s
  ),
  10,
  'dashboard_summary counts the NEW order as placed (orderCount=1, completedCount=0)'
);

-- ── (4) menu-health block present ────────────────────────────────────────────
select is(
  (
    select (s->'menu'->>'totalProducts')::int
      from public.dashboard_summary('ffff8888-0000-0000-0000-00000000cafe', 'today') s
  ),
  1,
  'dashboard_summary.menu reports product totals'
);

-- ── (5) metrics wrapper actually readable ────────────────────────────────────
select lives_ok(
  $$ select count(*) from public.store_daily_metrics_v $$,
  'authenticated can select from store_daily_metrics_v'
);

-- ── (6) pg_net reference is schema-valid ─────────────────────────────────────
reset role;
select ok(
  pg_get_functiondef(
    (select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname='public' and p.proname='notify_order_transition' limit 1)
  ) ~* 'perform\s+net\.http_post'
  and pg_get_functiondef(
    (select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname='public' and p.proname='notify_order_transition' limit 1)
  ) !~* 'extensions\.net\.http_post',
  'notify_order_transition calls net.http_post (not the invalid extensions.net.*)'
);

select * from finish();
rollback;
