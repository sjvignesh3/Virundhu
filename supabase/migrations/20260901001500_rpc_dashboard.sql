-- =============================================================================
-- 20260901001500_rpc_dashboard.sql
-- Purpose : dashboard summary + sales-report row source.
-- Range values match legacy: 'today' | '7d' | '30d'.
-- =============================================================================

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
  v_order_cnt  integer;
  v_avg        numeric(14,2);
  v_top        jsonb;
begin
  if not auth.has_store(p_store_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_from := case p_range
    when 'today' then date_trunc('day', now())
    when '7d'    then now() - interval '7 days'
    when '30d'   then now() - interval '30 days'
    else              date_trunc('day', now())
  end;

  select coalesce(sum(total), 0),
         count(*),
         coalesce(avg(total), 0)
    into v_revenue, v_order_cnt, v_avg
    from public.orders
   where store_id = p_store_id
     and status = 'COMPLETED'
     and placed_at >= v_from;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
    into v_top
    from (
      select oi.product_id,
             oi.name_snapshot as name,
             sum(oi.quantity)  as qty,
             sum(oi.line_total) as revenue
        from public.order_items oi
        join public.orders o on o.id = oi.order_id
       where o.store_id = p_store_id
         and o.status = 'COMPLETED'
         and o.placed_at >= v_from
       group by oi.product_id, oi.name_snapshot
       order by revenue desc
       limit 5
    ) t;

  return jsonb_build_object(
    'range',         p_range,
    'revenue',       v_revenue,
    'orderCount',    v_order_cnt,
    'avgOrderValue', round(v_avg, 2),
    'topProducts',   v_top
  );
end;
$$;

grant execute on function public.dashboard_summary(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Row source for CSV export. PostgREST streams these to the browser which
-- serialises to CSV client-side (papaparse) — keeps the RPC portable.
-- ---------------------------------------------------------------------------
create or replace function public.reports_sales_rows(
  p_store_id uuid,
  p_from     date,
  p_to       date
)
  returns table (
    order_no       text,
    placed_at      timestamptz,
    status         public.order_status,
    customer_name  text,
    subtotal       numeric(12,2),
    tax            numeric(12,2),
    total          numeric(12,2),
    items          integer
  )
  language sql
  stable
  security definer
  set search_path = public, pg_temp
as $$
  select
    o.order_no,
    o.placed_at,
    o.status,
    o.customer_name,
    o.subtotal,
    o.tax,
    o.total,
    (select count(*)::int from public.order_items i where i.order_id = o.id) as items
  from public.orders o
  where auth.has_store(o.store_id)
    and o.store_id = p_store_id
    and o.placed_at >= p_from::timestamptz
    and o.placed_at <  (p_to + 1)::timestamptz
  order by o.placed_at desc;
$$;

grant execute on function public.reports_sales_rows(uuid, date, date) to authenticated;
