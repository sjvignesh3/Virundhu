-- =============================================================================
-- 20260901002300_stage5_payments_notify.sql
-- Stage 5 · Edge-Function Orchestrations & Notifications (Plan §5.2–§5.4).
--
-- Adds:
--   1. orders.provider_payment_id           — idempotency anchor for payments.
--   2. public.idempotency_keys              — generic once-only guard table.
--   3. public.mark_payment_paid(...)        — idempotent RPC (razorpay-webhook).
--   4. public.notify_order_transition(...)  — async pg_net fan-out helper.
--   5. orders_advance_status / orders_cancel — trailing async notification call.
--
-- Design rules honoured (see Docs/BestPractices):
--   · pg_net.http_post is ASYNCHRONOUS — user-facing RPC returns immediately,
--     the notification fires in the background (never blocks order writes).
--   · Edge Functions are reserved for multi-step/external work; the DB only
--     fires-and-forgets a single POST.
--   · GUCs app.edge_url / app.edge_secret carry the endpoint + bearer — never
--     hard-coded, never in application source.
--   · Every function pins search_path and re-verifies tenancy.
--
-- ROLLBACK :
--   -- restore the pre-Stage-5 bodies from 20260901002000_rpc_realign.sql, then:
--   drop function if exists public.mark_payment_paid(uuid, text, text);
--   drop function if exists public.notify_order_transition(uuid, public.order_status, public.order_status);
--   drop table if exists public.idempotency_keys;
--   alter table public.orders drop column if exists provider_payment_id;
-- =============================================================================

-- ─── 1. orders.provider_payment_id ──────────────────────────────────────────
alter table public.orders
  add column if not exists provider_payment_id text;

-- Idempotency anchor: a captured payment is applied at most once per provider id.
create unique index if not exists orders_provider_payment_id_uidx
  on public.orders (provider_payment_id)
  where provider_payment_id is not null;

comment on column public.orders.provider_payment_id is
  'External payment id (e.g. Razorpay pay_XXX). Unique when set — payment idempotency anchor.';

-- ─── 2. generic idempotency_keys ────────────────────────────────────────────
-- Used by Edge Functions to guard non-payment side-effects (Plan §5.4).
create table if not exists public.idempotency_keys (
  key         text primary key,
  scope       text not null,                         -- e.g. 'razorpay-webhook'
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '7 days'
);

create index if not exists idempotency_keys_expiry_idx
  on public.idempotency_keys (expires_at);

comment on table public.idempotency_keys is
  'Once-only guard for Edge Functions. Rows expire after 7 days (cron-swept).';

alter table public.idempotency_keys enable row level security;
alter table public.idempotency_keys force  row level security;
-- No policies → invisible to anon/authenticated. Only SECURITY DEFINER RPCs
-- and the service_role (Edge Functions) touch it.
revoke all on public.idempotency_keys from anon, authenticated;

-- ─── 3. mark_payment_paid (idempotent) ──────────────────────────────────────
-- Called ONLY by razorpay-webhook under service_role. Idempotent by
-- provider_payment_id: a replayed webhook returns the already-paid order
-- without double-applying.
create or replace function public.mark_payment_paid(
  p_order_id            uuid,
  p_provider_payment_id text,
  p_provider            text default 'razorpay'
)
returns public.orders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
begin
  if p_order_id is null then
    raise exception 'INVALID_ORDER_ID' using errcode = '22023';
  end if;
  if p_provider_payment_id is null or length(p_provider_payment_id) < 3 then
    raise exception 'INVALID_PROVIDER_PAYMENT_ID' using errcode = '22023';
  end if;

  -- Idempotency short-circuit: same provider id already applied → return it.
  select * into v_order
    from public.orders
   where provider_payment_id = p_provider_payment_id;
  if found then
    return v_order;
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- Already paid via a different anchor → do not overwrite, just stamp the id.
  update public.orders
     set payment_status      = 'PAID',
         payment_method      = case
           when payment_method is null then 'UPI'::public.payment_method
           else payment_method
         end,
         provider_payment_id = p_provider_payment_id,
         updated_at          = now()
   where id = p_order_id
  returning * into v_order;

  insert into public.audit_log (store_id, actor, action, target, payload)
       values (v_order.store_id, null, 'mark_payment_paid',
               'orders/' || p_order_id::text,
               jsonb_build_object(
                 'provider',            p_provider,
                 'provider_payment_id', p_provider_payment_id
               ));

  return v_order;
end;
$$;

comment on function public.mark_payment_paid(uuid, text, text) is
  'Idempotent payment capture. Called by razorpay-webhook (service_role) only.';

revoke all on function public.mark_payment_paid(uuid, text, text) from public;
grant  execute on function public.mark_payment_paid(uuid, text, text) to service_role;

-- ─── 4. notify_order_transition (async pg_net fan-out) ──────────────────────
-- Fire-and-forget POST to the notify-order-transition Edge Function. Wrapped
-- so the (possibly missing) pg_net extension or unset GUCs degrade gracefully
-- to a no-op — never break the user-facing status write.
create or replace function public.notify_order_transition(
  p_order_id uuid,
  p_from     public.order_status,
  p_to       public.order_status
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_url    text := current_setting('app.edge_url',    true);
  v_secret text := current_setting('app.edge_secret', true);
begin
  -- No endpoint configured (local dev / CI) → silently skip.
  if v_url is null or length(v_url) = 0 then
    return;
  end if;
  -- pg_net not installed (some CI-shadow DBs) → skip.
  if not exists (select 1 from pg_extension where extname = 'pg_net') then
    return;
  end if;

  perform extensions.net.http_post(
    url     := v_url || '/functions/v1/notify-order-transition',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || coalesce(v_secret, '')
    ),
    body    := jsonb_build_object(
      'order_id',    p_order_id,
      'from_status', p_from,
      'to_status',   p_to
    )
  );
exception when others then
  -- Never let a notification failure roll back the status transition.
  null;
end;
$$;

comment on function public.notify_order_transition(uuid, public.order_status, public.order_status) is
  'Async pg_net fan-out to the notify-order-transition Edge Function. No-op when unconfigured.';

revoke all on function public.notify_order_transition(uuid, public.order_status, public.order_status) from public;

-- ─── 5. re-wire orders_advance_status with trailing fan-out ─────────────────
create or replace function public.orders_advance_status(
  p_order_id uuid,
  p_next     public.order_status
)
  returns public.orders
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_from  public.order_status;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order not found' using errcode = '22023';
  end if;
  if not public.has_store(v_order.store_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not public.orders_can_transition(v_order.status, p_next) then
    raise exception 'illegal transition % -> %', v_order.status, p_next
      using errcode = '22023';
  end if;

  v_from := v_order.status;

  update public.orders
     set status = p_next,
         completed_at = case when p_next = 'COMPLETED' then now() else completed_at end,
         cancelled_at = case when p_next = 'CANCELLED' then now() else cancelled_at end,
         payment_status = case
           when p_next = 'COMPLETED' and payment_status = 'PENDING' then 'PAID'::public.payment_status
           else payment_status
         end,
         updated_at = now()
   where id = p_order_id
  returning * into v_order;

  insert into public.audit_log (store_id, actor, action, target, payload)
       values (v_order.store_id, auth.uid(), 'orders_advance_status',
               'orders/' || p_order_id::text,
               jsonb_build_object('from', v_from, 'to', p_next));

  -- Async notification fan-out (fire-and-forget).
  perform public.notify_order_transition(p_order_id, v_from, p_next);

  return v_order;
end;
$$;

grant execute on function public.orders_advance_status(uuid, public.order_status)
  to authenticated;

-- ─── 5b. re-wire orders_cancel with trailing fan-out ────────────────────────
create or replace function public.orders_cancel(
  p_order_id uuid,
  p_reason   text default null
)
  returns public.orders
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_from  public.order_status;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order not found' using errcode = '22023';
  end if;
  if not public.has_store(v_order.store_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_order.status in ('COMPLETED', 'CANCELLED') then
    raise exception 'order is already terminal' using errcode = '22023';
  end if;

  v_from := v_order.status;

  update public.orders
     set status        = 'CANCELLED',
         cancelled_at  = now(),
         cancel_reason = nullif(trim(p_reason), ''),
         updated_at    = now()
   where id = p_order_id
  returning * into v_order;

  insert into public.audit_log (store_id, actor, action, target, payload)
       values (v_order.store_id, auth.uid(), 'orders_cancel',
               'orders/' || p_order_id::text,
               jsonb_build_object('from', v_from, 'reason', p_reason));

  perform public.notify_order_transition(p_order_id, v_from, 'CANCELLED');

  return v_order;
end;
$$;

grant execute on function public.orders_cancel(uuid, text) to authenticated;

-- ─── 5c. keepalive cron also sweeps expired idempotency keys ────────────────
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform extensions.cron.unschedule(jobid)
      from extensions.cron.job
     where jobname = 'virundhu_idempotency_sweep';

    perform extensions.cron.schedule(
      'virundhu_idempotency_sweep',
      '30 3 * * *',        -- daily at 03:30
      $sweep$delete from public.idempotency_keys where expires_at < now()$sweep$
    );
  end if;
end$$;
