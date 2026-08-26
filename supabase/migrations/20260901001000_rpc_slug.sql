-- =============================================================================
-- 20260901001000_rpc_slug.sql
-- Purpose : public slug availability check for the signup form.
-- =============================================================================

create or replace function public.store_slug_available(p_slug text)
  returns boolean
  language sql
  stable
  security definer
  set search_path = public, pg_temp
as $$
  select
    public.is_valid_slug(p_slug)
    and not exists (select 1 from public.stores where slug = p_slug::extensions.citext);
$$;

comment on function public.store_slug_available is
  'Returns true when p_slug is well-formed AND not taken. Callable by anon.';

-- Anyone (including anon) may check availability.
grant execute on function public.store_slug_available(text) to anon, authenticated;
