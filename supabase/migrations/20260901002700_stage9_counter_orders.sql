-- =============================================================================
-- 20260901002700_stage9_counter_orders.sql
-- Purpose : Stage 9 — walk-in counter sales + two fixes surfaced by live QA.
--
--   1. SIGNUP FIX — Stage 7's provision_tenant/5 recreation revoked EXECUTE
--      from public/anon/authenticated but never re-granted service_role, so
--      the auth-signup Edge Function failed with "permission denied for
--      function provision_tenant" on every signup.
--   2. NEW → PREPARING — the Live Orders board drops the ACCEPTED column
--      (product decision: one tap from NEW straight into the kitchen).
--      ACCEPTED remains a valid enum + transition source so legacy rows and
--      the Razorpay path keep validating.
--   3. orders_create_counter — owner-side POS entry for customers ordering
--      at the counter (no phone). Creates the order ALREADY COMPLETED + PAID
--      in one atomic write: it must appear in history/dashboard revenue and
--      never on the live board. Server-authoritative pricing identical to
--      orders_create; skips the accept_orders / minimum_order_value guards
--      (the owner is standing at the till — a counter sale is always valid).
--
-- ROLLBACK:
--   revoke execute on function public.provision_tenant(uuid,text,text,text,text) from service_role;
--   -- restore orders_can_transition from 20260901002000;
--   drop function if exists public.orders_create_counter(uuid, jsonb, public.payment_method, text, text);
-- =============================================================================

-- ─── 1. signup grant ─────────────────────────────────────────────────────────
grant execute on function public.provision_tenant(uuid, text, text, text, text)
  to service_role;

-- ─── 2. transition matrix: allow NEW → PREPARING ─────────────────────────────
create or replace function public.orders_can_transition(
  p_from public.order_status,
  p_to   public.order_status
)
  returns boolean
  language sql
  immutable
as $$
  select case p_from
    when 'NEW'        then p_to in ('ACCEPTED', 'PREPARING', 'CANCELLED')
    when 'ACCEPTED'   then p_to in ('PREPARING', 'CANCELLED')
    when 'PREPARING'  then p_to in ('READY', 'CANCELLED')
    when 'READY'      then p_to in ('COMPLETED', 'CANCELLED')
    when 'COMPLETED'  then false
    when 'CANCELLED'  then false
    else false
  end;
$$;

comment on function public.orders_can_transition is
  'SQL mirror of @virundhu/shared transitions.ts. NEW→PREPARING added in Stage 9 (live board has no ACCEPTED column).';

-- ─── 3. counter sale RPC ─────────────────────────────────────────────────────
create or replace function public.orders_create_counter(
  p_store_id       uuid,
  p_items          jsonb,
  p_payment_method public.payment_method default 'CASH',
  p_customer_name  text default null,
  p_notes          text default null
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
begin
  -- Owner-only: this writes a PAID+COMPLETED order, so tenancy is mandatory
  -- (unlike the anon customer path in orders_create).
  if not public.has_store(p_store_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_payment_method not in ('CASH', 'UPI') then
    raise exception 'unsupported payment_method — v1 accepts CASH or UPI only'
      using errcode = '22023';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'order must contain at least one item' using errcode = '22023';
  end if;

  select * into v_store from public.stores where id = p_store_id;
  if not found then
    raise exception 'store not found' using errcode = '22023';
  end if;
  -- NOTE: deliberately no status/accept_orders/minimum_order_value guard —
  -- counter sales happen at the till regardless of the public menu state.

  for v_item in select * from jsonb_array_elements(p_items) loop
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

    if not found or v_product.store_id <> p_store_id then
      raise exception 'product % is not available',
        coalesce(v_item->>'product_id', v_item->>'productId')
        using errcode = '22023';
    end if;

    v_subtotal := v_subtotal + round(v_product.price * v_qty, 2);
  end loop;

  v_tax   := round(v_subtotal * v_store.tax_rate / 100, 2);
  v_total := round(v_subtotal + v_tax, 2);

  v_order_no := public.next_order_number(p_store_id);

  insert into public.orders (
    store_id, order_number, status, payment_status, payment_method,
    customer_name, customer_phone, notes,
    subtotal, tax_amount, discount_amount, total_amount, completed_at
  ) values (
    p_store_id, v_order_no, 'COMPLETED', 'PAID', p_payment_method,
    nullif(trim(p_customer_name), ''), null,
    nullif(trim(p_notes), ''),
    v_subtotal, v_tax, 0, v_total, now()
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
      v_order.id, v_product.id, v_product.name, v_product.tamil_name,
      v_product.unit, v_product.price,
      coalesce((v_item->>'quantity')::integer, (v_item->>'qty')::integer),
      null
    );
  end loop;

  insert into public.audit_log (store_id, actor, action, target, payload)
       values (p_store_id, auth.uid(), 'orders_create_counter',
               'orders/' || v_order.id::text,
               jsonb_build_object(
                 'order_number',   v_order_no,
                 'total',          v_total,
                 'items',          jsonb_array_length(p_items),
                 'payment_method', p_payment_method
               ));

  return v_order;
end;
$$;

comment on function public.orders_create_counter(uuid, jsonb, public.payment_method, text, text) is
  'Owner POS entry for walk-in customers: atomic COMPLETED+PAID order that lands in history/dashboard, never on the live board.';

revoke all on function public.orders_create_counter(uuid, jsonb, public.payment_method, text, text)
  from public, anon;
grant execute on function public.orders_create_counter(uuid, jsonb, public.payment_method, text, text)
  to authenticated;
