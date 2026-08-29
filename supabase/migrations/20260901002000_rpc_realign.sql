-- =============================================================================
-- 20260901002000_rpc_realign.sql
-- Purpose : replace RPCs whose bodies referenced pre-alignment column names
--           (order_no, tax, total, placed_at, sort_order, is_active,
--           name_snapshot) with contract-aligned versions.
-- =============================================================================

-- ─── orders_create ────────────────────────────────────────────────────────────
create or replace function public.orders_create(
  p_store_id       uuid,
  p_items          jsonb,
  p_customer_name  text default null,
  p_customer_phone text default null,
  p_notes          text default null,
  p_payment_method public.payment_method default 'SIMULATED'
)
  returns public.orders
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
declare
  v_store       public.stores%rowtype;
  v_order       public.orders%rowtype;
  v_order_no    text;
  v_subtotal    numeric(12,2) := 0;
  v_tax         numeric(12,2) := 0;
  v_total       numeric(12,2) := 0;
  v_item        jsonb;
  v_product     public.products%rowtype;
  v_qty         integer;
  v_line_total  numeric(12,2);
begin
  if not public.has_store(p_store_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'order must contain at least one item' using errcode = '22023';
  end if;

  select * into v_store from public.stores where id = p_store_id;
  if not found then
    raise exception 'store not found' using errcode = '22023';
  end if;
  if v_store.status <> 'OPEN' or not v_store.accept_orders then
    raise exception 'store is not accepting orders' using errcode = '22023';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    -- accept both { productId, quantity } and { product_id, quantity }
    v_qty := coalesce(
      (v_item->>'quantity')::integer,
      (v_item->>'qty')::integer,
      0
    );
    if v_qty <= 0 then
      raise exception 'quantity must be positive' using errcode = '22023';
    end if;

    select * into v_product
      from public.products
     where id = coalesce(
       (v_item->>'product_id')::uuid,
       (v_item->>'productId')::uuid
     )
     for share;

    if not found or v_product.store_id <> p_store_id or not v_product.is_available then
      raise exception 'product % is not available',
        coalesce(v_item->>'product_id', v_item->>'productId')
        using errcode = '22023';
    end if;

    v_line_total := round(v_product.price * v_qty, 2);
    v_subtotal   := v_subtotal + v_line_total;
  end loop;

  v_tax   := round(v_subtotal * v_store.tax_rate / 100, 2);
  v_total := round(v_subtotal + v_tax, 2);

  if v_total < v_store.minimum_order_value then
    raise exception 'order below minimum of %', v_store.minimum_order_value
      using errcode = '22023';
  end if;

  v_order_no := public.next_order_number(p_store_id);

  insert into public.orders (
    store_id, order_number, status, payment_status, payment_method,
    customer_name, customer_phone, notes,
    subtotal, tax_amount, discount_amount, total_amount
  ) values (
    p_store_id, v_order_no, 'NEW', 'PENDING', p_payment_method,
    nullif(trim(p_customer_name), ''),
    nullif(trim(p_customer_phone), ''),
    nullif(trim(p_notes), ''),
    v_subtotal, v_tax, 0, v_total
  )
  returning * into v_order;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product
      from public.products
     where id = coalesce(
       (v_item->>'product_id')::uuid,
       (v_item->>'productId')::uuid
     );

    insert into public.order_items (
      order_id, product_id, product_name, product_tamil_name, unit,
      unit_price, quantity, notes
    ) values (
      v_order.id,
      v_product.id,
      v_product.name,
      v_product.tamil_name,
      v_product.unit,
      v_product.price,
      coalesce((v_item->>'quantity')::integer, (v_item->>'qty')::integer),
      nullif(trim(v_item->>'notes'), '')
    );
  end loop;

  insert into public.audit_log (store_id, actor, action, target, payload)
       values (p_store_id, auth.uid(), 'orders_create',
               'orders/' || v_order.id::text,
               jsonb_build_object(
                 'order_number', v_order_no,
                 'total',        v_total,
                 'items',        jsonb_array_length(p_items)
               ));

  return v_order;
end;
$$;

grant execute on function public.orders_create(
  uuid, jsonb, text, text, text, public.payment_method
) to anon, authenticated;

-- ─── orders_advance_status ────────────────────────────────────────────────────
-- Body did not reference renamed columns; recreate anyway to pin search_path.
-- Function body unchanged aside from paranoid `payment_status` cast.
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
               jsonb_build_object('to', p_next));
  return v_order;
end;
$$;

grant execute on function public.orders_advance_status(uuid, public.order_status)
  to authenticated;

-- ─── dashboard_summary ────────────────────────────────────────────────────────
-- References orders.total (renamed → total_amount) and orders.placed_at
-- (dropped in favour of created_at). Rewritten below.
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
  if not public.has_store(p_store_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_from := case p_range
    when 'today' then date_trunc('day', now())
    when '7d'    then now() - interval '7 days'
    when '30d'   then now() - interval '30 days'
    else              date_trunc('day', now())
  end;

  select coalesce(sum(total_amount), 0),
         count(*),
         coalesce(avg(total_amount), 0)
    into v_revenue, v_order_cnt, v_avg
    from public.orders
   where store_id = p_store_id
     and status = 'COMPLETED'
     and created_at >= v_from;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
    into v_top
    from (
      select oi.product_id,
             oi.product_name as name,
             sum(oi.quantity)   as qty,
             sum(oi.line_total) as revenue
        from public.order_items oi
        join public.orders o on o.id = oi.order_id
       where o.store_id = p_store_id
         and o.status = 'COMPLETED'
         and o.created_at >= v_from
       group by oi.product_id, oi.product_name
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

-- ─── reports_sales_rows ───────────────────────────────────────────────────────
create or replace function public.reports_sales_rows(
  p_store_id uuid,
  p_from     date,
  p_to       date
)
  returns table (
    order_number   text,
    created_at     timestamptz,
    status         public.order_status,
    customer_name  text,
    subtotal       numeric(12,2),
    tax_amount     numeric(12,2),
    total_amount   numeric(12,2),
    items          integer
  )
  language sql
  stable
  security definer
  set search_path = public, pg_temp
as $$
  select
    o.order_number,
    o.created_at,
    o.status,
    o.customer_name,
    o.subtotal,
    o.tax_amount,
    o.total_amount,
    (select count(*)::int from public.order_items i where i.order_id = o.id) as items
  from public.orders o
  where public.has_store(o.store_id)
    and o.store_id = p_store_id
    and o.created_at >= p_from::timestamptz
    and o.created_at <  (p_to + 1)::timestamptz
  order by o.created_at desc;
$$;

grant execute on function public.reports_sales_rows(uuid, date, date) to authenticated;

-- ─── categories_reorder / products_reorder ───────────────────────────────────
create or replace function public.categories_reorder(
  p_store_id uuid,
  p_ids      uuid[]
)
  returns setof public.categories
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
begin
  if not public.has_store(p_store_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if exists (
    select 1 from unnest(p_ids) with ordinality as t(id, ord)
    left join public.categories c on c.id = t.id
    where c.store_id is distinct from p_store_id
  ) then
    raise exception 'invalid category id in reorder payload' using errcode = '22023';
  end if;

  update public.categories c
     set display_order = t.ord - 1,
         updated_at = now()
    from unnest(p_ids) with ordinality as t(id, ord)
   where c.id = t.id and c.store_id = p_store_id;

  insert into public.audit_log (store_id, actor, action, target, payload)
       values (p_store_id, auth.uid(), 'categories_reorder', 'categories',
               jsonb_build_object('count', array_length(p_ids, 1)));

  return query
    select * from public.categories
     where store_id = p_store_id
     order by display_order, name;
end;
$$;
grant execute on function public.categories_reorder(uuid, uuid[]) to authenticated;

create or replace function public.products_reorder(
  p_store_id uuid,
  p_ids      uuid[]
)
  returns setof public.products
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
begin
  if not public.has_store(p_store_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if exists (
    select 1 from unnest(p_ids) with ordinality as t(id, ord)
    left join public.products p on p.id = t.id
    where p.store_id is distinct from p_store_id
  ) then
    raise exception 'invalid product id in reorder payload' using errcode = '22023';
  end if;

  update public.products p
     set display_order = t.ord - 1,
         updated_at = now()
    from unnest(p_ids) with ordinality as t(id, ord)
   where p.id = t.id and p.store_id = p_store_id;

  insert into public.audit_log (store_id, actor, action, target, payload)
       values (p_store_id, auth.uid(), 'products_reorder', 'products',
               jsonb_build_object('count', array_length(p_ids, 1)));

  return query
    select * from public.products
     where store_id = p_store_id
     order by display_order, name;
end;
$$;
grant execute on function public.products_reorder(uuid, uuid[]) to authenticated;
