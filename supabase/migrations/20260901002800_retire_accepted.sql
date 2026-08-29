-- =============================================================================
-- 20260901002800_retire_accepted.sql
-- Purpose : Retire the ACCEPTED order status completely (product decision,
--           2026-08-29 live QA). The board is NEW → PREPARING → READY →
--           COMPLETED; a lingering ACCEPTED row (created by older clients)
--           rendered confusingly in the Preparing column.
--
--   1. Data: migrate any existing ACCEPTED rows to PREPARING.
--   2. Matrix: ACCEPTED is no longer a legal TARGET from any status. It stays
--      a legal SOURCE (→ PREPARING/CANCELLED) purely as a safety valve for
--      rows written by a stale client mid-deploy; and the enum value itself
--      is kept — dropping a Postgres enum value requires a type rebuild and
--      buys nothing.
--
-- Mirror: @virundhu/shared transitions.ts (same commit).
--
-- ROLLBACK:
--   -- restore orders_can_transition from 20260901002700 (ACCEPTED as target);
--   -- (data migration is not reversible — ACCEPTED rows become PREPARING)
-- =============================================================================

update public.orders
   set status = 'PREPARING', updated_at = now()
 where status = 'ACCEPTED';

create or replace function public.orders_can_transition(
  p_from public.order_status,
  p_to   public.order_status
)
  returns boolean
  language sql
  immutable
as $$
  select case p_from
    when 'NEW'        then p_to in ('PREPARING', 'CANCELLED')
    when 'ACCEPTED'   then p_to in ('PREPARING', 'CANCELLED')  -- legacy escape hatch only
    when 'PREPARING'  then p_to in ('READY', 'CANCELLED')
    when 'READY'      then p_to in ('COMPLETED', 'CANCELLED')
    when 'COMPLETED'  then false
    when 'CANCELLED'  then false
    else false
  end;
$$;

comment on function public.orders_can_transition is
  'SQL mirror of @virundhu/shared transitions.ts. ACCEPTED retired as a target (Stage 9.1) — flow is NEW → PREPARING → READY → COMPLETED.';
