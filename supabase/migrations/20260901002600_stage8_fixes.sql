-- =============================================================================
-- 20260901002600_stage8_fixes.sql
-- Purpose : Fixes from the 2026-08-29 verification audit.
--
--   1. Realtime — add `orders` to the supabase_realtime publication. Without
--      this the owner Live Orders board never receives postgres_changes
--      events anywhere (the publication shipped empty).
--   2. Order numbers — restore the legacy `FC-1001` format (per-store,
--      monotonic, no daily reset) promised by Plan ("keep FC-XXXX order
--      numbers") and printed on existing customer receipts.
--   3. dashboard_summary v2 — count *placed* orders (not just COMPLETED),
--      expose active/completed/cancelled splits and menu-health stats so the
--      owner dashboard renders in ONE round-trip. Adds an 'all' range.
--   4. store_daily_metrics_v — the security_invoker wrapper could not be
--      read by anyone (invoker lacks matview SELECT). Replace with an
--      owner-rights barrier view filtered by has_store(), same pattern as
--      public_store_menu.
--   5. notify_order_transition — `extensions.net.http_post` is an invalid
--      three-part name (always errored, silently). pg_net lives in the
--      `net` schema.
--   6. mark_payment_paid — serialize concurrent first deliveries of the same
--      provider_payment_id (advisory lock) so the loser returns the paid
--      order instead of dying on the unique index.
--
-- ROLLBACK:
--   alter publication supabase_realtime drop table public.orders;
--   -- restore next_order_number / dashboard_summary / notify_order_transition
--   -- / mark_payment_paid from 20260901002000 + 20260901002300;
--   -- restore store_daily_metrics_v from 20260901002400.
-- =============================================================================

-- ─── 1. Realtime publication ────────────────────────────────────────────────
-- Supabase Realtime streams only tables in the `supabase_realtime`
-- publication. RLS still applies per-subscriber (WALRUS checks the owner
-- SELECT policy), so events stay tenant-scoped.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
exception when undefined_object then
  -- Publication absent on bare shadow DBs (CI diff) — create it.
  create publication supabase_realtime for table public.orders;
end$$;

-- ─── 2. next_order_number → FC-1001 format ──────────────────────────────────
-- Legacy contract: first order is FC-1001 and the counter never resets.
-- Reuses order_sequences with a fixed sentinel day as the per-store row so
-- no schema change is required; old (store, day) rows are simply ignored.
create or replace function public.next_order_number(p_store_id uuid)
  returns text
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
declare
  v_sentinel constant date := date '2000-01-01';
  v_no       integer;
begin
  -- Advisory lock keyed per store: concurrent order creations serialize on
  -- the counter, never on the whole table.
  perform pg_advisory_xact_lock(
    hashtextextended('order_no:' || p_store_id::text, 0)
  );

  insert into public.order_sequences (store_id, day, last_no)
       values (p_store_id, v_sentinel, 1001)
  on conflict (store_id, day)
    do update set last_no = public.order_sequences.last_no + 1
  returning last_no into v_no;

  return 'FC-' || v_no::text;
end;
$$;

comment on function public.next_order_number is
  'Allocates the next per-store order number (FC-1001, FC-1002, …). Advisory-lock protected; never resets.';

revoke all on function public.next_order_number(uuid) from public, anon, authenticated;

-- ─── 3. dashboard_summary v2 ────────────────────────────────────────────────
create or replace function public.dashboard_summary(
  p_store_id uuid,
  p_range    text default 'today'
)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = public, pg_temp
as $$
declare
  v_from       timestamptz;
  v_revenue    numeric(14,2);
  v_placed     integer;
  v_completed  integer;
  v_cancelled  integer;
  v_avg        numeric(14,2);
  v_active     integer;
  v_top        jsonb;
  v_menu       jsonb;
begin
  if not public.has_store(p_store_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_from := case p_range
    when 'today' then date_trunc('day', now())
    when '7d'    then now() - interval '7 days'
    when '30d'   then now() - interval '30 days'
    when 'all'   then timestamptz '-infinity'
    else              date_trunc('day', now())
  end;

  -- One pass over the range: placed / completed / cancelled / revenue.
  select count(*),
         count(*) filter (where status = 'COMPLETED'),
         count(*) filter (where status = 'CANCELLED'),
         coalesce(sum(total_amount) filter (where status = 'COMPLETED'), 0),
         coalesce(avg(total_amount) filter (where status = 'COMPLETED'), 0)
    into v_placed, v_completed, v_cancelled, v_revenue, v_avg
    from public.orders
   where store_id = p_store_id
     and created_at >= v_from;

  -- Active = currently in the kitchen, regardless of range.
  select count(*)
    into v_active
    from public.orders
   where store_id = p_store_id
     and status in ('NEW', 'ACCEPTED', 'PREPARING', 'READY');

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
    into v_top
    from (
      select oi.product_id,
             oi.product_name as name,
             sum(oi.quantity)::int  as qty,
             sum(oi.line_total)     as revenue
        from public.order_items oi
        join public.orders o on o.id = oi.order_id
       where o.store_id = p_store_id
         and o.status = 'COMPLETED'
         and o.created_at >= v_from
       group by oi.product_id, oi.product_name
       order by revenue desc
       limit 5
    ) t;

  -- Menu health for the dashboard MENU row (total / hidden / low / out).
  select jsonb_build_object(
           'totalProducts', count(*),
           'available',     count(*) filter (where is_available),
           'unavailable',   count(*) filter (where not is_available),
           'lowStock',      count(*) filter (
                              where is_available
                                and stock_quantity is not null
                                and low_stock_threshold is not null
                                and stock_quantity > 0
                                and stock_quantity <= low_stock_threshold),
           'outOfStock',    count(*) filter (
                              where stock_quantity is not null
                                and stock_quantity <= 0)
         )
    into v_menu
    from public.products
   where store_id = p_store_id;

  return jsonb_build_object(
    'range',          p_range,
    'revenue',        v_revenue,
    'orderCount',     v_placed,
    'completedCount', v_completed,
    'cancelledCount', v_cancelled,
    'activeCount',    v_active,
    'avgOrderValue',  round(v_avg, 2),
    'topProducts',    v_top,
    'menu',           v_menu
  );
end;
$$;

grant execute on function public.dashboard_summary(uuid, text) to authenticated;

-- ─── 4. store_daily_metrics_v — readable tenant-scoped wrapper ──────────────
-- The 002400 version used security_invoker over a matview whose SELECT was
-- revoked from authenticated → permission denied for every caller. Recreate
-- as an owner-rights barrier view (postgres owns it and CAN read the
-- matview); has_store() keeps it tenant-scoped exactly like public_store_menu.
drop view if exists public.store_daily_metrics_v;
create view public.store_daily_metrics_v
  with (security_barrier = true)
as
  select m.store_id, m.placed_day, m.order_count, m.revenue, m.avg_order_value
    from public.store_daily_metrics m
   where public.has_store(m.store_id);

grant select on public.store_daily_metrics_v to authenticated;
-- Raw matview stays revoked (002400) — the view is the only window.

-- ─── 5. notify_order_transition — valid pg_net reference ────────────────────
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
  if v_url is null or length(v_url) = 0 then
    return;
  end if;
  if not exists (select 1 from pg_extension where extname = 'pg_net') then
    return;
  end if;

  -- pg_net installs its API in the `net` schema (NOT extensions.net —
  -- the previous three-part name errored on every call).
  perform net.http_post(
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

revoke all on function public.notify_order_transition(uuid, public.order_status, public.order_status) from public;

-- ─── 6. mark_payment_paid — race-safe idempotency ───────────────────────────
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

  -- Serialize concurrent deliveries of the same provider payment id so the
  -- second arrival hits the short-circuit instead of the unique index.
  perform pg_advisory_xact_lock(
    hashtextextended('vpp:' || p_provider_payment_id, 0)
  );

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

revoke all on function public.mark_payment_paid(uuid, text, text) from public;
grant  execute on function public.mark_payment_paid(uuid, text, text) to service_role;
