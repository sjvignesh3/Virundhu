-- =============================================================================
-- 20260901000100_extensions.sql
-- Purpose : enable the extensions the rest of the schema depends on.
-- Idempotent, safe to replay.
-- =============================================================================

-- All non-core extensions live in a dedicated schema so that
-- (a) search_path pollution is avoided and
-- (b) grants can be revoked from application roles wholesale.
create schema if not exists extensions;

create extension if not exists pgcrypto     with schema extensions;
create extension if not exists "uuid-ossp"  with schema extensions;
create extension if not exists citext       with schema extensions;

-- pg_cron & pg_net are privileged; Supabase installs them into the
-- `extensions` schema and only the `postgres` role may schedule jobs.
create extension if not exists pg_cron      with schema extensions;
create extension if not exists pg_net       with schema extensions;

-- pgTAP for SQL unit tests. Only loaded in local/CI (Supabase test runner).
do $$
begin
  if current_setting('server_version_num')::int >= 160000 then
    create extension if not exists pgtap with schema extensions;
  end if;
exception when others then
  -- pgtap is optional in production; ignore if unavailable.
  null;
end$$;

-- Convenience: put extensions on the search path for RPC bodies that need
-- gen_random_uuid() etc. without a schema prefix.
alter database postgres set search_path = "$user", public, extensions;
