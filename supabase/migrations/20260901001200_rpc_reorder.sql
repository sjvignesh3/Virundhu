-- =============================================================================
-- 20260901001200_rpc_reorder.sql
-- Purpose : bulk-reorder categories & products in one transaction.
-- Client sends the desired id[] order; the RPC assigns sort_order = index.
-- =============================================================================

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
  if not auth.has_store(p_store_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Assert every id belongs to this store — prevents cross-tenant reorder.
  if exists (
    select 1
    from unnest(p_ids) with ordinality as t(id, ord)
    left join public.categories c on c.id = t.id
    where c.store_id is distinct from p_store_id
  ) then
    raise exception 'invalid category id in reorder payload'
      using errcode = '22023';
  end if;

  update public.categories c
     set sort_order = t.ord - 1,
         updated_at = now()
    from unnest(p_ids) with ordinality as t(id, ord)
   where c.id = t.id
     and c.store_id = p_store_id;

  insert into public.audit_log (store_id, actor, action, target, payload)
       values (p_store_id, auth.uid(), 'categories_reorder', 'categories',
               jsonb_build_object('count', array_length(p_ids, 1)));

  return query
    select * from public.categories
     where store_id = p_store_id
     order by sort_order, name;
end;
$$;

grant execute on function public.categories_reorder(uuid, uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
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
  if not auth.has_store(p_store_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if exists (
    select 1
    from unnest(p_ids) with ordinality as t(id, ord)
    left join public.products p on p.id = t.id
    where p.store_id is distinct from p_store_id
  ) then
    raise exception 'invalid product id in reorder payload'
      using errcode = '22023';
  end if;

  update public.products p
     set sort_order = t.ord - 1,
         updated_at = now()
    from unnest(p_ids) with ordinality as t(id, ord)
   where p.id = t.id
     and p.store_id = p_store_id;

  insert into public.audit_log (store_id, actor, action, target, payload)
       values (p_store_id, auth.uid(), 'products_reorder', 'products',
               jsonb_build_object('count', array_length(p_ids, 1)));

  return query
    select * from public.products
     where store_id = p_store_id
     order by sort_order, name;
end;
$$;

grant execute on function public.products_reorder(uuid, uuid[]) to authenticated;
