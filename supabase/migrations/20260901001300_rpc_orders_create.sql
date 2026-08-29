-- =============================================================================
-- 20260901001300_rpc_orders_create.sql
-- Purpose : atomic order creation. Client sends [{product_id, quantity, notes}].
-- The RPC:
--   - re-verifies tenancy
--   - locks each product FOR SHARE and reads authoritative price
--   - recomputes subtotal/tax/total server-side
--   - allocates order_no via next_order_number()
--   - inserts order + items in one transaction
--   - writes an audit row
-- =============================================================================

create or replace function public.orders_create(
  p_store_id       uuid,
  p_items          jsonb,         -- [{ "product_id": "...", "quantity": n, "notes": "..." }]
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
  ----------------------------------------------------------------- validation
  if not public.has_store(p_store_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'order must contain at least one item'
      using errcode = '22023';
  end if;

  select * into v_store from public.stores where id = p_store_id;
  if not found then
    raise exception 'store not found' using errcode = '22023';
  end if;
  if v_store.status <> 'OPEN' then
    raise exception 'store is not accepting orders' using errcode = '22023';
  end if;

  ----------------------------------------------------------- price computation
  -- We iterate items, take a FOR SHARE lock on each product row (so its price
  -- cannot mutate mid-transaction), and accumulate the authoritative subtotal.
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := coalesce((v_item->>'quantity')::integer, 0);
    if v_qty <= 0 then
      raise exception 'quantity must be positive' using errcode = '22023';
    end if;

    select * into v_product
      from public.products
     where id = (v_item->>'product_id')::uuid
     for share;

    if not found or v_product.store_id <> p_store_id or not v_product.is_active then
      raise exception 'product % is not available',
        v_item->>'product_id' using errcode = '22023';
    end if;

    v_line_total := round(v_product.price * v_qty, 2);
    v_subtotal   := v_subtotal + v_line_total;
  end loop;

  v_tax   := round(v_subtotal * v_store.tax_rate / 100, 2);
  v_total := round(v_subtotal + v_tax, 2);

  ------------------------------------------------------------- order allocation
  v_order_no := public.next_order_number(p_store_id);

  insert into public.orders (
    store_id, order_no, status, payment_status, payment_method,
    customer_name, customer_phone, notes,
    subtotal, tax, total
  ) values (
    p_store_id, v_order_no, 'NEW', 'PENDING', p_payment_method,
    nullif(trim(p_customer_name), ''),
    nullif(trim(p_customer_phone), ''),
    nullif(trim(p_notes), ''),
    v_subtotal, v_tax, v_total
  )
  returning * into v_order;

  ----------------------------------------------------- item rows (second pass)
  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product
      from public.products
     where id = (v_item->>'product_id')::uuid;

    insert into public.order_items (
      order_id, product_id, name_snapshot, unit_price, quantity, notes
    ) values (
      v_order.id,
      v_product.id,
      v_product.name,
      v_product.price,
      (v_item->>'quantity')::integer,
      nullif(trim(v_item->>'notes'), '')
    );
  end loop;

  --------------------------------------------------------------------- audit
  insert into public.audit_log (store_id, actor, action, target, payload)
       values (p_store_id, auth.uid(), 'orders_create',
               'orders/' || v_order.id::text,
               jsonb_build_object(
                 'order_no', v_order_no,
                 'total',    v_total,
                 'items',    jsonb_array_length(p_items)
               ));

  return v_order;
end;
$$;

comment on function public.orders_create is
  'Atomic order creation. Prices, totals, and order_no are computed server-side.';

-- Anon may create orders (customer-facing ordering page has no login).
grant execute on function public.orders_create(
  uuid, jsonb, text, text, text, public.payment_method
) to anon, authenticated;
