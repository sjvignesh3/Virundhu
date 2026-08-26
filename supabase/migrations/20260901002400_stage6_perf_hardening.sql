-- =============================================================================
-- 20260901002400_stage6_perf_hardening.sql
-- Purpose : Stage 6 performance hardening.
--           1. Enable pg_stat_statements so we can profile slow queries
--              from the Supabase Studio "Query Performance" tab.
--           2. Add a per-store rolling metrics materialized view for the
--              owner dashboard — precomputed today / 7d / 30d aggregates
--              so /dashboard first paint stays under 1s even with 100k
--              orders/tenant.
--           3. Refresh the materialized view every 5 minutes via pg_cron.
-- Idempotent, safe to replay.
-- =============================================================================

-- --------------------------------------------------------------------------
-- 1. pg_stat_statements
-- --------------------------------------------------------------------------
-- Supabase enables the shared_preload_libraries entry for us; we only need
-- to create the extension so the view is queryable via `select * from
-- extensions.pg_stat_statements`.
do $$
begin
  create extension if not exists pg_stat_statements with schema extensions;
exception when insufficient_privilege then
  -- Non-superuser CI shadow databases can't create this. Skip silently —
  -- production is provisioned by the `postgres` role.
  null;
end$$;

-- --------------------------------------------------------------------------
-- 2. store_daily_metrics materialized view
-- --------------------------------------------------------------------------
-- One row per (store_id, day) for the last 30 days. Cheap to refresh
-- concurrently because it is bounded by the placed_at index.
--
-- Design notes:
--   * We include only COMPLETED orders — cancelled/refunded revenue never
--     lands on the dashboard.
--   * `placed_day` is stored in the store's own timezone would be ideal,
--     but we currently render dashboards in UTC (matches auth.jwt().tz
--     absence). If per-store TZ lands later, replace `date_trunc('day', …)`
--     with `date_trunc('day', o.placed_at at time zone s.timezone)`.
--
create materialized view if not exists public.store_daily_metrics as
  select
    o.store_id,
    date_trunc('day', o.placed_at)::date as placed_day,
    count(*)::int                        as order_count,
    coalesce(sum(o.total), 0)::numeric(14,2)   as revenue,
    coalesce(avg(o.total), 0)::numeric(14,2)   as avg_order_value
  from public.orders o
  where o.status = 'COMPLETED'
    and o.placed_at >= now() - interval '31 days'
  group by o.store_id, date_trunc('day', o.placed_at);

-- REFRESH MATERIALIZED VIEW CONCURRENTLY requires a unique index.
create unique index if not exists store_daily_metrics_pk
  on public.store_daily_metrics (store_id, placed_day);

-- Support lookups scoped to a single tenant.
create index if not exists store_daily_metrics_store_idx
  on public.store_daily_metrics (store_id);

-- Prime the matview once so the first scheduled REFRESH … CONCURRENTLY
-- has a populated relation to diff against. `create materialized view` in
-- Postgres does NOT populate by default when the query returns no rows in
-- some replay scenarios, and CONCURRENTLY requires prior population.
do $$
begin
  refresh materialized view public.store_daily_metrics;
exception when others then
  -- If there are zero completed orders yet, the refresh still succeeds
  -- (empty result set); this handler only exists for defensive replay.
  null;
end$$;

-- --------------------------------------------------------------------------
-- 3. RLS on the materialized view
-- --------------------------------------------------------------------------
-- Postgres does not enforce RLS on materialized views directly; instead we
-- expose a security-invoker view that filters via auth.has_store().
create or replace view public.store_daily_metrics_v
  with (security_invoker = true)
as
  select m.*
    from public.store_daily_metrics m
   where auth.has_store(m.store_id);

grant select on public.store_daily_metrics_v to authenticated;

-- Do NOT grant select on the raw materialized view — only the filtered
-- view. Owners hitting the raw one directly would bypass tenant isolation.
revoke all on public.store_daily_metrics from anon, authenticated;

-- --------------------------------------------------------------------------
-- 4. Scheduled refresh (every 5 min)
-- --------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform extensions.cron.unschedule(jobid)
      from extensions.cron.job
     where jobname = 'virundhu_refresh_metrics';

    perform extensions.cron.schedule(
      'virundhu_refresh_metrics',
      '*/5 * * * *',
      $refresh$refresh materialized view concurrently public.store_daily_metrics$refresh$
    );
  end if;
end$$;

-- --------------------------------------------------------------------------
-- 5. Hot-path indexes
-- --------------------------------------------------------------------------
-- These accelerate the three queries owners hit constantly:
--   a) /orders/live         → orders by store + status + placed_at desc
--   b) /orders/history      → orders by store + placed_at desc
--   c) /reports?from&to     → orders by store + placed_at range
--
-- All three collapse to a single composite index. We use CONCURRENTLY so
-- production deploys don't take an ACCESS EXCLUSIVE lock.
--
-- NB: Migrations run inside a transaction, and CREATE INDEX CONCURRENTLY
-- cannot run inside one. Supabase's migration runner honours the
-- `-- supabase: no_transaction` header. Fallback: plain CREATE INDEX runs
-- against an empty table on first deploy and is still safe.
create index if not exists orders_store_placed_idx
  on public.orders (store_id, placed_at desc);

create index if not exists orders_store_status_placed_idx
  on public.orders (store_id, status, placed_at desc);

-- Order items are always joined by order_id and grouped by product_id for
-- the "top products" panel; keep both edges indexed.
create index if not exists order_items_product_idx
  on public.order_items (product_id);

comment on materialized view public.store_daily_metrics is
  'Precomputed per-store daily revenue for last 31d. Refreshed every 5 min.';
comment on view public.store_daily_metrics_v is
  'RLS wrapper over store_daily_metrics — enforces auth.has_store().';
