-- =============================================================================
-- 20260901001700_cron_keepalive.sql
-- Purpose : keep Supabase's free-tier project from being paused after 7 days
--           of inactivity. Runs a trivial SELECT every 6 hours.
-- Safety  : pg_cron jobs run as the postgres superuser; the SQL executed
--           here is a bounded, read-only ping.
-- =============================================================================

do $$
begin
  -- Only attempt scheduling if pg_cron is actually installed (it is not on
  -- some CI-shadow databases).
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- Idempotent: unschedule any previous version first.
    perform extensions.cron.unschedule(jobid)
      from extensions.cron.job
     where jobname = 'virundhu_keepalive';

    perform extensions.cron.schedule(
      'virundhu_keepalive',
      '0 */6 * * *',       -- every 6 hours
      $keepalive$select 1 from public.stores limit 1$keepalive$
    );
  end if;
end$$;

comment on extension pg_cron is
  'Scheduled jobs. virundhu_keepalive runs every 6h to prevent free-tier pause.';
