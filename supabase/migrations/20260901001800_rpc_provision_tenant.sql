-- =============================================================================
-- 20260901001800_rpc_provision_tenant.sql
-- Purpose : atomically create a store + owner membership for a freshly
--           signed-up user. Invoked by the auth-signup Edge Function under
--           the service_role — never callable from anon/authenticated.
-- =============================================================================

create or replace function public.provision_tenant(
  p_user_id    uuid,
  p_store_name text,
  p_store_slug text,
  p_owner_name text default null
)
  returns jsonb
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
declare
  v_store public.stores%rowtype;
begin
  if not public.is_valid_slug(p_store_slug) then
    raise exception 'invalid slug' using errcode = '22023';
  end if;

  insert into public.stores (slug, name)
       values (p_store_slug::extensions.citext, p_store_name)
    returning * into v_store;

  insert into public.store_members (store_id, user_id, role)
       values (v_store.id, p_user_id, 'OWNER');

  insert into public.audit_log (store_id, actor, action, target, payload)
       values (v_store.id, p_user_id, 'provision_tenant',
               'stores/' || v_store.id::text,
               jsonb_build_object('slug', p_store_slug, 'owner_name', p_owner_name));

  return jsonb_build_object(
    'id',   v_store.id,
    'slug', v_store.slug,
    'name', v_store.name
  );
exception
  when unique_violation then
    raise exception 'slug is already taken' using errcode = '23505';
end;
$$;

-- Revoke from every application role — only service_role invokes this.
revoke all on function public.provision_tenant(uuid, text, text, text)
  from public, anon, authenticated;
