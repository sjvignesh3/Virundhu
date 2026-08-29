-- =============================================================================
-- 20260901002500_stage7_upi_cash_only.sql
--
-- Stage 7 · UPI / Cash-only checkout (Razorpay + WhatsApp deferred).
-- Product decision (2026-09-01): ship v1 without a gateway. Customers pay
-- in-person by CASH or with a UPI intent-URL that launches their own app;
-- notifications happen out-of-band. Razorpay + WhatsApp code stays in the
-- tree as boilerplate but is unwired from the runtime path.
--
-- Changes:
--   1. stores.upi_id            — vendor's Virtual Payment Address (VPA).
--                                 Nullable → CASH-only when empty.
--   2. provision_tenant(...)    — new signature with p_store_upi_id.
--   3. public_store_menu view   — exposes store.upiId to the public menu.
--   4. orders_advance_status /  — drop `notify_order_transition` call so
--      orders_cancel               the fan-out is truly opt-in via Runbook.
--                                 (The function itself stays as boilerplate.)
--
-- ROLLBACK :
--   -- restore the Stage 5 bodies from 20260901002300_stage5_payments_notify.sql
--   -- then:
--   drop function if exists public.provision_tenant(uuid, text, text, text, text);
--   alter table public.stores drop column if exists upi_id;
--   -- re-run 20260901002100_view_public_menu_realign.sql to restore the view.
-- =============================================================================

-- ─── 1. stores.upi_id ────────────────────────────────────────────────────────
alter table public.stores
  add column if not exists upi_id text
    check (
      upi_id is null
      or upi_id ~ '^[a-z0-9][a-z0-9._-]{1,49}@[a-z][a-z0-9]{2,29}$'
    );

comment on column public.stores.upi_id is
  'Vendor Virtual Payment Address (VPA). When set, checkout can generate a '
  '`upi://pay?pa=...` intent link. When null, orders are CASH-only.';

-- ─── 2. provision_tenant with UPI ID ────────────────────────────────────────
-- Drop the older 4-arg signature so PostgREST resolves the new call
-- unambiguously.  (New 5-arg version below.)
drop function if exists public.provision_tenant(uuid, text, text, text);

create or replace function public.provision_tenant(
  p_user_id      uuid,
  p_store_name   text,
  p_store_slug   text,
  p_owner_name   text default null,
  p_store_upi_id text default null
)
  returns jsonb
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
declare
  v_store  public.stores%rowtype;
  v_upi    text := nullif(trim(lower(coalesce(p_store_upi_id, ''))), '');
begin
  if not public.is_valid_slug(p_store_slug) then
    raise exception 'invalid slug' using errcode = '22023';
  end if;

  if v_upi is not null
     and v_upi !~ '^[a-z0-9][a-z0-9._-]{1,49}@[a-z][a-z0-9]{2,29}$' then
    raise exception 'invalid UPI id' using errcode = '22023';
  end if;

  insert into public.stores (slug, name, upi_id)
       values (p_store_slug::extensions.citext, p_store_name, v_upi)
    returning * into v_store;

  insert into public.store_members (store_id, user_id, role)
       values (v_store.id, p_user_id, 'OWNER');

  insert into public.audit_log (store_id, actor, action, target, payload)
       values (v_store.id, p_user_id, 'provision_tenant',
               'stores/' || v_store.id::text,
               jsonb_build_object(
                 'slug',       p_store_slug,
                 'owner_name', p_owner_name,
                 'upi_set',    (v_upi is not null)
               ));

  return jsonb_build_object(
    'id',    v_store.id,
    'slug',  v_store.slug,
    'name',  v_store.name,
    'upiId', v_store.upi_id
  );
exception
  when unique_violation then
    raise exception 'slug is already taken' using errcode = '23505';
end;
$$;

revoke all on function public.provision_tenant(uuid, text, text, text, text)
  from public, anon, authenticated;

comment on function public.provision_tenant(uuid, text, text, text, text) is
  'Signup-time tenant bootstrap. Called by the auth-signup Edge Function '
  'under service_role. Idempotency: slug unique index blocks duplicates.';

-- ─── 3. public_store_menu view — expose upiId ───────────────────────────────
drop view if exists public.public_store_menu;

create view public.public_store_menu
  with (security_barrier = true, security_invoker = false) as
select
  s.slug,
  jsonb_build_object(
    'id',                            s.id,
    'slug',                          s.slug,
    'name',                          s.name,
    'tamilName',                     s.tamil_name,
    'description',                   s.description,
    'phone',                         s.phone,
    'address',                       s.address,
    'logoUrl',                       s.logo_url,
    'imageUrl',                      s.image_url,
    'upiId',                         s.upi_id,
    'status',                        s.status,
    'settings', jsonb_build_object(
      'defaultLanguage',             s.default_language,
      'showTamilNames',              s.show_tamil_names,
      'showUnavailable',             s.show_unavailable,
      'acceptOrders',                s.accept_orders,
      'minimumOrderValue',           s.minimum_order_value,
      'estimatedPreparationMinutes', s.estimated_preparation_minutes
    )
  ) as store,
  coalesce(
    (
      select jsonb_agg(cat order by (cat->>'displayOrder')::int, cat->>'name')
      from (
        select jsonb_build_object(
          'id',           c.id,
          'name',         c.name,
          'tamilName',    c.tamil_name,
          'description',  c.description,
          'displayOrder', c.display_order,
          'products',     coalesce(
            (
              select jsonb_agg(
                jsonb_build_object(
                  'id',              p.id,
                  'name',            p.name,
                  'tamilName',       p.tamil_name,
                  'description',     p.description,
                  'tamilDescription',p.tamil_description,
                  'price',           p.price,
                  'unit',            p.unit,
                  'imageUrl',        p.image_url,
                  'stockQuantity',   p.stock_quantity,
                  'isAvailable',     p.is_available,
                  'displayOrder',    p.display_order
                )
                order by p.display_order, p.name
              )
              from public.products p
              where p.category_id = c.id
                and (s.show_unavailable or p.is_available)
            ),
            '[]'::jsonb
          )
        ) as cat
        from public.categories c
        where c.store_id  = s.id
          and c.is_active = true
      ) x
    ),
    '[]'::jsonb
  ) as categories
from public.stores s
where s.status = 'OPEN';

comment on view public.public_store_menu is
  'Public read-only menu (v1: includes vendor UPI id for the checkout '
  'intent-URL button). CamelCase JSONB payload — anon-safe by RLS.';

grant select on public.public_store_menu to anon, authenticated;

-- ─── 4. orders_create — narrow payment_method + guard ──────────────────────
-- Product decision: customers may only pick CASH or UPI at checkout in v1.
-- The DB enum still accepts SIMULATED/CARD for legacy rows and future re-
-- introduction, but the RPC rejects them now so no client can slip one in.
create or replace function public.orders_create(
  p_store_id       uuid,
  p_items          jsonb,
  p_customer_name  text default null,
  p_customer_phone text default null,
  p_notes          text default null,
  p_payment_method public.payment_method default 'CASH'
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
  if p_payment_method not in ('CASH', 'UPI') then
    raise exception 'unsupported payment_method — v1 accepts CASH or UPI only'
      using errcode = '22023';
  end if;

  if p_store_id is null then
    raise exception 'store id required' using errcode = '22023';
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

  -- If the customer chose UPI but the vendor has no VPA on file, degrade to
  -- CASH rather than fail — a failed checkout costs a sale.
  if p_payment_method = 'UPI' and v_store.upi_id is null then
    p_payment_method := 'CASH';
  end if;

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
      v_order.id, v_product.id, v_product.name, v_product.tamil_name,
      v_product.unit, v_product.price,
      coalesce((v_item->>'quantity')::integer, (v_item->>'qty')::integer),
      nullif(trim(v_item->>'notes'), '')
    );
  end loop;

  insert into public.audit_log (store_id, actor, action, target, payload)
       values (p_store_id, auth.uid(), 'orders_create',
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

grant execute on function public.orders_create(
  uuid, jsonb, text, text, text, public.payment_method
) to anon, authenticated;

-- ─── 5. drop notify fan-out from advance/cancel RPCs ────────────────────────
-- The Edge Function + pg_net helper stay in the tree as boilerplate so we
-- can re-enable notifications by editing these two RPC bodies. Until then
-- every status transition is a pure DB write with zero network I/O.
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

  -- Notification fan-out DEFERRED — see Runbook §8.7. Re-enable by adding:
  --   perform public.notify_order_transition(p_order_id, v_from, p_next);
  return v_order;
end;
$$;

grant execute on function public.orders_advance_status(uuid, public.order_status)
  to authenticated;

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

  -- Notification fan-out DEFERRED — see Runbook §8.7.
  return v_order;
end;
$$;

grant execute on function public.orders_cancel(uuid, text) to authenticated;
