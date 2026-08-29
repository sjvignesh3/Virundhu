-- =============================================================================
-- 20260901000300_helpers.sql
-- Purpose : cross-cutting helper functions used by policies, RPCs, and triggers.
-- These MUST be created before any table that references them in a policy.
--
-- NOTE ON SCHEMA PLACEMENT
-- ─────────────────────────
-- Supabase's local Docker runner executes migrations as the `postgres` role,
-- which does NOT have CREATE privilege on the `auth` schema (that belongs to
-- `supabase_admin`). Our three JWT helpers therefore live in `public` and
-- call the built-in `auth.jwt()` / `auth.uid()` functions (which remain in
-- the Supabase-managed `auth` schema and are always accessible).
--
-- The old `auth.jwt_store_ids`, `auth.jwt_role`, `auth.has_store` names are
-- replaced by `public.jwt_store_ids`, `public.jwt_role`, `public.has_store`
-- throughout every migration and RLS policy.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- JWT accessors. Wrapped as STABLE functions so the planner can cache them
-- per-query, and so that policy expressions stay concise.
-- ---------------------------------------------------------------------------
create or replace function public.jwt_store_ids()
  returns uuid[]
  language sql
  stable
  security definer
  set search_path = public, pg_temp
as $$
  select coalesce(
    (
      select array_agg((v)::uuid)
      from jsonb_array_elements_text(
        coalesce(auth.jwt() -> 'app_metadata' -> 'store_ids', '[]'::jsonb)
      ) as v
    ),
    array[]::uuid[]
  );
$$;

comment on function public.jwt_store_ids is
  'Returns the store_ids claim from the caller''s JWT app_metadata as uuid[].';

-- Grant to both roles so RLS policies (which run as the querying role) can
-- call it; SECURITY DEFINER means the function always executes as its owner.
grant execute on function public.jwt_store_ids() to anon, authenticated;

-- ---------------------------------------------------------------------------
create or replace function public.jwt_role()
  returns text
  language sql
  stable
  security definer
  set search_path = public, pg_temp
as $$
  select nullif(
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', ''),
    ''
  );
$$;

comment on function public.jwt_role is
  'Returns the role claim from the caller''s JWT app_metadata (OWNER|STAFF).';

grant execute on function public.jwt_role() to anon, authenticated;

-- ---------------------------------------------------------------------------
create or replace function public.has_store(p_store_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = public, pg_temp
as $$
  select p_store_id = any(public.jwt_store_ids());
$$;

comment on function public.has_store is
  'True when the caller''s JWT grants access to the given store_id.';

grant execute on function public.has_store(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- updated_at maintenance. One trigger function reused across every table.
-- ---------------------------------------------------------------------------
create or replace function public.tg_set_updated_at()
  returns trigger
  language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Slug validation. Kept in SQL so PostgREST inserts get the same guarantees
-- as RPC-driven ones.
-- ---------------------------------------------------------------------------
create or replace function public.is_valid_slug(p_slug text)
  returns boolean
  language sql
  immutable
as $$
  select p_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
     and char_length(p_slug) between 3 and 48;
$$;
