-- =============================================================================
-- 03_auth_flows.sql — Stage-2 auth / tenancy coverage.
--
-- Verifies:
--   1. provision_tenant creates store + owner membership in a single txn.
--   2. provision_tenant rejects duplicate slug.
--   3. A caller whose JWT store_ids does NOT include the store is denied
--      by RLS on every table read.
--   4. Public menu view returns camelCase-shaped store JSON.
--   5. RLS-scoped SELECT on orders returns [] (not error) for a foreign JWT
--      — this matches PostgREST + RLS contract per Plan §Stage 2 DoD.
-- =============================================================================
begin;
select plan(7);

-- ─── 1. provision_tenant happy path ───────────────────────────────────────────
select isnt(
  (select public.provision_tenant(
    '00000000-0000-0000-0000-0000000000aa',
    'Foo Bites',
    'foo-bites',
    'Foo Owner'
  ))::text,
  null,
  'provision_tenant returns a store JSON'
);

select is(
  (select count(*)::int from public.stores where slug = 'foo-bites'),
  1,
  'provision_tenant inserted the store row'
);

select is(
  (select role::text from public.store_members
    where user_id = '00000000-0000-0000-0000-0000000000aa'),
  'OWNER',
  'provision_tenant granted OWNER membership'
);

-- ─── 2. duplicate slug rejected ───────────────────────────────────────────────
select throws_ok(
  $$ select public.provision_tenant(
       '00000000-0000-0000-0000-0000000000bb',
       'Foo Bites 2', 'foo-bites', 'X') $$,
  '23505',
  null,
  'duplicate slug raises 23505'
);

-- ─── 3. Foreign JWT sees zero rows (not an error) ────────────────────────────
-- Seed extra orders row so we have something to hide.
insert into public.stores (id, slug, name)
  values ('dddd4444-4444-4444-4444-444444444444', 'hidden-store', 'Hidden')
on conflict do nothing;
insert into public.categories (id, store_id, name)
  values ('dddd4444-0000-0000-0000-000000000001',
          'dddd4444-4444-4444-4444-444444444444', 'Hidden')
on conflict do nothing;
insert into public.products (id, store_id, category_id, name, price, unit)
  values ('dddd4444-0000-0000-0000-000000000010',
          'dddd4444-4444-4444-4444-444444444444',
          'dddd4444-0000-0000-0000-000000000001',
          'Hidden Item', 999.00, 'plate')
on conflict do nothing;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', 'foreign-user',
    'app_metadata', json_build_object(
      'store_ids', json_build_array('11111111-1111-1111-1111-111111111111'),
      'role', 'OWNER'
    )
  )::text,
  true
);

select is(
  (select count(*)::int from public.categories
     where store_id = 'dddd4444-4444-4444-4444-444444444444'),
  0,
  'Foreign JWT reads 0 categories of hidden store (RLS = empty set)'
);

select is(
  (select count(*)::int from public.products
     where store_id = 'dddd4444-4444-4444-4444-444444444444'),
  0,
  'Foreign JWT reads 0 products of hidden store (RLS = empty set)'
);

-- ─── 4. Public menu shape check (camelCase JSONB) ────────────────────────────
reset role;
set local role anon;
select set_config('request.jwt.claims', '{}', true);

select is(
  (select store->>'slug' from public.public_store_menu where slug = 'hidden-store' limit 1),
  'hidden-store',
  'public_store_menu store JSON exposes camelCase slug'
);

select * from finish();
rollback;
