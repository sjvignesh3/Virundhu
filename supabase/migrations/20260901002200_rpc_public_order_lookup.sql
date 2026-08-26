-- =============================================================================
-- 20260901002200_rpc_public_order_lookup.sql
-- Purpose : anonymous order lookup for the success page (Plan §4.4).
--           A customer who just placed an order has (store_slug, order_number)
--           — the SPA calls this RPC to render a receipt without exposing the
--           `orders` table via RLS.
--
-- Safety  : SECURITY DEFINER, but restricted by (slug, order_number) tuple which
--           is effectively a shared secret — order numbers are dense but the
--           slug adds a store-level namespace. Function returns ONLY the
--           columns needed for a receipt; PII (customer_name, phone) is
--           deliberately omitted.
--
--           Rate limiting is handled at the Vercel edge (default 100 rps/IP).
--
-- ROLLBACK :
--   drop function if exists public.public_order_lookup(text, text);
-- =============================================================================

create or replace function public.public_order_lookup(
  p_slug         text,
  p_order_number text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_store_id uuid;
  v_order    public.orders%rowtype;
  v_items    jsonb;
begin
  if p_slug is null or length(p_slug) < 2 then
    raise exception 'INVALID_SLUG' using errcode = '22023';
  end if;
  if p_order_number is null or length(p_order_number) < 3 then
    raise exception 'INVALID_ORDER_NUMBER' using errcode = '22023';
  end if;

  select id into v_store_id
    from public.stores
   where slug = p_slug
     and status = 'OPEN';
  if v_store_id is null then
    raise exception 'STORE_NOT_FOUND' using errcode = 'P0002';
  end if;

  select * into v_order
    from public.orders
   where store_id = v_store_id
     and order_number = p_order_number;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0002';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'name',       oi.product_name,
        'quantity',   oi.quantity,
        'unitPrice',  oi.unit_price,
        'lineTotal',  oi.line_total
      )
      order by oi.created_at
    ),
    '[]'::jsonb
  )
  into v_items
  from public.order_items oi
  where oi.order_id = v_order.id;

  return jsonb_build_object(
    'orderNumber',   v_order.order_number,
    'status',        v_order.status,
    'paymentStatus', v_order.payment_status,
    'subtotal',      v_order.subtotal,
    'tax',           v_order.tax_amount,
    'total',         v_order.total_amount,
    'placedAt',      v_order.created_at,
    'items',         v_items
  );
end;
$$;

comment on function public.public_order_lookup(text, text) is
  'Anonymous receipt lookup by (slug, order_number). Returns minimal shape — no PII.';

-- Grant EXECUTE to anon (and authenticated for completeness).
revoke all on function public.public_order_lookup(text, text) from public;
grant  execute on function public.public_order_lookup(text, text) to anon, authenticated;
