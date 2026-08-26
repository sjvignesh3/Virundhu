-- =============================================================================
-- 20260901000800_audit.sql
-- Purpose : append-only audit trail. Every RPC inserts one row.
-- =============================================================================

create table if not exists public.audit_log (
  id            bigserial primary key,
  occurred_at   timestamptz not null default now(),
  store_id      uuid,
  actor         uuid,           -- auth.uid() at time of action
  action        text not null,  -- e.g. 'orders_create'
  target        text,           -- e.g. 'orders/<uuid>'
  payload       jsonb not null default '{}'::jsonb
);

create index if not exists audit_log_store_time_idx
  on public.audit_log (store_id, occurred_at desc);

comment on table public.audit_log is
  'Append-only audit trail. Written by SECURITY DEFINER RPCs; never updated.';

-- Revoke every mutation from application roles: only DEFINER RPCs may insert.
revoke insert, update, delete on public.audit_log from public;
