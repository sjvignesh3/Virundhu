-- =============================================================================
-- 20260901001400_rpc_orders_status.sql
-- Purpose : status-machine enforcement mirroring packages/shared/transitions.ts.
-- =============================================================================

create or replace function public.orders_can_transition(
  p_from public.order_status,
  p_to   public.order_status
) returns boolean
  language sql
  immutable
as $$
  select case p_from
    when 'NEW'        then p_to in ('ACCEPTED', 'CANCELLED')
    when 'ACCEPTED'   then p_to in ('PREPARING', 'CANCELLED')
    when 'PREPARING'  then p_to in ('READY', 'CANCELLED')
    when 'READY'      then p_to in ('COMPLETED', 'CANCELLED')
    when 'COMPLETED'  then false
    when 'CANCELLED'  then false
    else false
  end;
$$;

comment on function public.orders_can_transition is
  'Order-status transition matrix. Byte-identical to @virundhu/shared/transitions.';

-- ---------------------------------------------------------------------------
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
  select * into v_order
    from public.orders
   where id = p_order_id
   for update;

  if not found then
    raise exception 'order not found' using errcode = '22023';
  end if;

  if not public.has_store(v_order.store_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if not public.orders_can_transition(v_order.status, p_next) then
    raise exception 'illegal transition % -> %',
      v_order.status, p_next using errcode = '22023';
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

-- ---------------------------------------------------------------------------
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
begin
  select * into v_order
    from public.orders
   where id = p_order_id
   for update;

  if not found then
    raise exception 'order not found' using errcode = '22023';
  end if;

  if not public.has_store(v_order.store_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_order.status in ('COMPLETED', 'CANCELLED') then
    raise exception 'order is already terminal' using errcode = '22023';
  end if;

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
               jsonb_build_object('reason', p_reason));

  return v_order;
end;
$$;

grant execute on function public.orders_cancel(uuid, text) to authenticated;
