-- =============================================================================
-- 20260901000300_helpers.sql
-- Purpose : cross-cutting helper functions used by policies, RPCs, and triggers.
-- These MUST be created before any table that references them in a policy.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- JWT accessors. Wrapped as STABLE functions so the planner can cache them
-- per-query, and so that policy expressions stay concise.
-- ---------------------------------------------------------------------------
create or replace function auth.jwt_store_ids()
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

comment on function auth.jwt_store_ids is
  'Returns the store_ids claim from the caller''s JWT app_metadata as uuid[].';

create or replace function auth.jwt_role()
  returns text
  language sql
  stable
as $$
  select nullif(
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', ''),
    ''
  );
$$;

comment on function auth.jwt_role is
  'Returns the role claim from the caller''s JWT app_metadata (OWNER|STAFF).';

create or replace function auth.has_store(p_store_id uuid)
  returns boolean
  language sql
  stable
as $$
  select p_store_id = any(auth.jwt_store_ids());
$$;

comment on function auth.has_store is
  'True when the caller''s JWT grants access to the given store_id.';

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
