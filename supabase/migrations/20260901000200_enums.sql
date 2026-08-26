-- =============================================================================
-- 20260901000200_enums.sql
-- Purpose : enum types shared by tables and RPCs.
-- These MUST stay byte-identical to packages/shared/src/enums.ts so that
-- PostgREST-serialised JSON validates against the frozen Zod schemas.
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'order_status') then
    create type public.order_status as enum (
      'NEW',
      'ACCEPTED',
      'PREPARING',
      'READY',
      'COMPLETED',
      'CANCELLED'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'payment_status') then
    create type public.payment_status as enum (
      'PENDING',
      'PAID',
      'FAILED',
      'REFUNDED'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'payment_method') then
    create type public.payment_method as enum (
      'SIMULATED',
      'UPI',
      'CARD',
      'CASH'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'store_status') then
    create type public.store_status as enum (
      'OPEN',
      'CLOSED'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'member_role') then
    create type public.member_role as enum (
      'OWNER',
      'MANAGER',
      'STAFF'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'printer_kind') then
    create type public.printer_kind as enum (
      'THERMAL',
      'LASER',
      'INKJET'
    );
  end if;
end$$;
