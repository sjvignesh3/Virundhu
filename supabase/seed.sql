-- =============================================================================
-- seed.sql — deterministic demo tenant for local dev + CI.
-- Replayed by `supabase db reset`. Idempotent via fixed UUIDs.
-- All column names are post-alignment (2026-09-01T00:19 migration).
-- =============================================================================

insert into public.stores (id, slug, name, status, currency, tax_rate, phone, address, accept_orders)
values (
  '11111111-1111-1111-1111-111111111111',
  'anna-street-food',
  'Anna Street Food',
  'OPEN', 'INR', 5.00,
  '+91 98765 43210',
  '12 Marina Loop, Chennai',
  true
)
on conflict (id) do nothing;

insert into public.store_members (store_id, user_id, role)
values (
  '11111111-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000001',
  'OWNER'
)
on conflict do nothing;

-- ---------------- Categories (display_order)
insert into public.categories (id, store_id, name, display_order) values
  ('22222222-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Starters',  0),
  ('22222222-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Mains',     1),
  ('22222222-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Beverages', 2)
on conflict (id) do nothing;

-- ---------------- Products (display_order, is_available, unit)
insert into public.products (id, store_id, category_id, name, description, price, unit, display_order) values
  ('33333333-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '22222222-0000-0000-0000-000000000001', 'Masala Vada',       'Crispy lentil fritters',   40.00, 'piece', 0),
  ('33333333-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '22222222-0000-0000-0000-000000000001', 'Cut Mirchi',        'Stuffed green chilli',     35.00, 'piece', 1),
  ('33333333-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', '22222222-0000-0000-0000-000000000002', 'Chicken Biriyani',  'Seeraga samba rice',      180.00, 'plate', 0),
  ('33333333-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', '22222222-0000-0000-0000-000000000002', 'Parotta + Salna',   'Two parottas + gravy',    120.00, 'plate', 1),
  ('33333333-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', '22222222-0000-0000-0000-000000000003', 'Masala Chai',       'Filter tea',               25.00, 'cup',   0),
  ('33333333-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', '22222222-0000-0000-0000-000000000003', 'Lime Soda',         'Salted / sweet',           45.00, 'glass', 1)
on conflict (id) do nothing;
