-- =============================================================================
-- 20260901001100_rpc_order_number.sql
-- Purpose : next_order_number() — collision-safe, per-store daily counter.
-- Format  : "<STORE_INITIAL>-<YYYYMMDD>-<0004>"  e.g.  "A-20260901-0007"
-- =============================================================================

create or replace function public.next_order_number(p_store_id uuid)
  returns text
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
declare
  v_day       date := (now() at time zone 'UTC')::date;
  v_no        integer;
  v_prefix    text;
begin
  -- Per-store advisory lock keeps two concurrent order creations from
  -- colliding on (store_id, day). Cheaper than table-level locking.
  perform pg_advisory_xact_lock(
    hashtextextended(p_store_id::text || v_day::text, 0)
  );

  insert into public.order_sequences (store_id, day, last_no)
       values (p_store_id, v_day, 1)
  on conflict (store_id, day)
    do update set last_no = public.order_sequences.last_no + 1
  returning last_no into v_no;

  select upper(left(coalesce(name, 'X'), 1))
    into v_prefix
    from public.stores
   where id = p_store_id;

  return format('%s-%s-%s',
    coalesce(v_prefix, 'X'),
    to_char(v_day, 'YYYYMMDD'),
    lpad(v_no::text, 4, '0')
  );
end;
$$;

comment on function public.next_order_number is
  'Allocates the next per-store daily order number. Advisory-lock protected.';

revoke all on function public.next_order_number(uuid) from public, anon, authenticated;
-- Only invoked from other SECURITY DEFINER RPCs.
