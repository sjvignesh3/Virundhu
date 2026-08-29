-- =============================================================================
-- 01_rls_tenancy.sql — cross-tenant isolation must be impossible.
-- =============================================================================
begin;
select plan(6);

-- Fixture: two stores, two "users" (via jwt.claims setting).
insert into public.stores (id, slug, name) values
  ('aaaa1111-1111-1111-1111-111111111111', 'alpha-cafe', 'Alpha Cafe'),
  ('bbbb2222-2222-2222-2222-222222222222', 'beta-bites', 'Beta Bites')
on conflict do nothing;

insert into public.categories (store_id, name) values
  ('aaaa1111-1111-1111-1111-111111111111', 'A-Cat'),
  ('bbbb2222-2222-2222-2222-222222222222', 'B-Cat')
on conflict do nothing;

-- Impersonate a JWT owning only the Alpha store.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', 'a1a1a1a1-0000-0000-0000-000000000001',
    'app_metadata', json_build_object(
      'store_ids', json_build_array('aaaa1111-1111-1111-1111-111111111111'),
      'role', 'OWNER'
    )
  )::text,
  true
);

select is(
  (select count(*)::int from public.categories where name = 'A-Cat'),
  1,
  'Alpha owner can see own category'
);
select is(
  (select count(*)::int from public.categories where name = 'B-Cat'),
  0,
  'Alpha owner CANNOT see Beta category'
);

-- Direct insert into someone else's store must fail.
select throws_ok(
  $$ insert into public.categories (store_id, name)
     values ('bbbb2222-2222-2222-2222-222222222222', 'Cross-tenant') $$,
  '42501',
  null,
  'Insert into foreign store denied by RLS'
);

-- Direct order writes must fail (RPC-only path).
select throws_ok(
  $$ insert into public.orders (store_id, order_number, subtotal, tax_amount, total_amount)
     values ('aaaa1111-1111-1111-1111-111111111111', 'X-1', 0, 0, 0) $$,
  '42501',
  null,
  'Direct order insert denied — RPC required'
);

-- Public view: anon may read only OPEN stores.
reset role;
set local role anon;
select set_config('request.jwt.claims', '{}', true);

select is(
  (select count(*)::int from public.public_store_menu where slug = 'alpha-cafe'),
  1,
  'Anon may read public menu of OPEN store'
);
-- anon has NO select grant at all on base tables (revoked in 000900) — a
-- direct read is a hard 42501, not a silent empty result. The public menu
-- view above is the only anon window.
select throws_ok(
  $$ select count(*) from public.categories $$,
  '42501',
  null,
  'Anon may NOT read categories table directly (permission denied)'
);

select * from finish();
rollback;
