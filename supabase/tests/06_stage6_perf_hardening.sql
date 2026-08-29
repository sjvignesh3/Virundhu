-- =============================================================================
-- 06_stage6_perf_hardening.sql — Stage 6 perf-hardening surface checks.
-- Verifies:
--   1. store_daily_metrics materialized view exists.
--   2. Its unique index (store_id, placed_day) exists — required for
--      REFRESH MATERIALIZED VIEW CONCURRENTLY to succeed.
--   3. The security-invoker RLS wrapper store_daily_metrics_v exists.
--   4. anon has NO select privilege on the raw materialized view.
--   5. authenticated has select on the wrapper view.
--   6. Hot-path composite index orders_store_status_created_idx exists.
--   7. The pg_cron refresh job 'virundhu_refresh_metrics' is scheduled
--      (skipped gracefully when pg_cron is absent, e.g. shadow DBs).
-- =============================================================================
begin;
select plan(7);

-- ── (1) materialized view exists ─────────────────────────────────────────────
select ok(
  exists(
    select 1
      from pg_matviews
     where schemaname = 'public'
       and matviewname = 'store_daily_metrics'
  ),
  'materialized view public.store_daily_metrics exists'
);

-- ── (2) unique index for CONCURRENTLY refresh ────────────────────────────────
select ok(
  exists(
    select 1
      from pg_indexes
     where schemaname = 'public'
       and indexname  = 'store_daily_metrics_pk'
  ),
  'unique index store_daily_metrics_pk exists (required for concurrent refresh)'
);

-- ── (3) RLS wrapper view exists ──────────────────────────────────────────────
select ok(
  exists(
    select 1
      from pg_views
     where schemaname = 'public'
       and viewname   = 'store_daily_metrics_v'
  ),
  'RLS wrapper view public.store_daily_metrics_v exists'
);

-- ── (4) anon cannot read the raw materialized view ───────────────────────────
select ok(
  not has_table_privilege('anon', 'public.store_daily_metrics', 'select'),
  'anon has NO select privilege on raw store_daily_metrics'
);

-- ── (5) authenticated can read the filtered wrapper ──────────────────────────
select ok(
  has_table_privilege('authenticated', 'public.store_daily_metrics_v', 'select'),
  'authenticated has select on store_daily_metrics_v'
);

-- ── (6) hot-path composite index ─────────────────────────────────────────────
select ok(
  exists(
    select 1
      from pg_indexes
     where schemaname = 'public'
       and indexname  = 'orders_store_status_created_idx'
  ),
  'composite index orders_store_status_created_idx exists on orders(store_id,status,created_at desc)'
);

-- ── (7) pg_cron refresh job scheduled (skip if pg_cron absent) ───────────────
do $$
declare
  v_has_cron boolean;
begin
  select exists(select 1 from pg_extension where extname = 'pg_cron') into v_has_cron;
  if v_has_cron then
    perform ok(
      exists(
        select 1 from cron.job where jobname = 'virundhu_refresh_metrics'
      ),
      'virundhu_refresh_metrics job is scheduled'
    );
  else
    perform skip(1, 'pg_cron not installed on this database');
  end if;
end$$;

select * from finish();
rollback;
