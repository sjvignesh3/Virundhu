-- =============================================================================
-- 00_smoke.sql — schema shape sanity checks.
-- Run: `supabase test db`
-- =============================================================================
begin;
select plan(14);

select has_extension('pgcrypto',   'pgcrypto is installed');
select has_extension('uuid-ossp',  'uuid-ossp is installed');
select has_extension('citext',     'citext is installed');

select has_table('public', 'stores',          'stores table exists');
select has_table('public', 'store_members',   'store_members table exists');
select has_table('public', 'categories',      'categories table exists');
select has_table('public', 'products',        'products table exists');
select has_table('public', 'orders',          'orders table exists');
select has_table('public', 'order_items',     'order_items table exists');
select has_table('public', 'printers',        'printers table exists');
select has_table('public', 'audit_log',       'audit_log table exists');
select has_table('public', 'order_sequences', 'order_sequences table exists');

select has_view('public', 'public_store_menu', 'public menu view exists');
select has_function('public', 'next_order_number', array['uuid'], 'next_order_number RPC exists');

select * from finish();
rollback;
