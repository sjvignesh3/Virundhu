# Supabase Backend (v2)

Greenfield backend-as-code for Virundhu CartSas. Everything in this directory is deployed
by the Supabase CLI — plain SQL migrations, PL/pgSQL RPCs, views, seed data, pgTAP tests,
and TypeScript Edge Functions (Deno).

## Layout

```
supabase/
├── config.toml           # local dev + CI config
├── migrations/           # ordered, timestamped .sql — the only source of schema truth
├── functions/            # Edge Functions (Deno + TS)
│   ├── _shared/          # shared helpers (imports @virundhu/shared via import_map.json)
│   └── auth-signup/
├── tests/                # pgTAP tests — every RLS policy + every RPC
├── seed.sql              # deterministic demo tenant for local dev + CI
└── import_map.json       # Deno import map — resolves @virundhu/shared
```

## Local workflow

```bash
# One-time
supabase start

# Iterate
supabase migration new my_change
$EDITOR supabase/migrations/*_my_change.sql
supabase db reset          # replays every migration + seed.sql from scratch
supabase test db           # runs pgTAP suite

# Ship
supabase db push           # to the linked remote project
```

## Migration ordering

Migration filenames are `YYYYMMDDHHMMSS_snake_case.sql`. **Never edit a migration after it
has been pushed.** Always add a new one. This is enforced by CI (`supabase db diff` must
report zero drift after replay).

## RPC conventions

- Named `<subject>_<verb>` (`orders_create`, `categories_reorder`).
- Always `SECURITY DEFINER`, always `SET search_path = public, pg_temp`.
- Always re-verify tenancy via `auth.has_store(p_store_id)` — never trust payload.
- Always return typed rows (never `void`) so PostgREST clients get a predictable response.

## RLS conventions

- Every table has `ENABLE ROW LEVEL SECURITY` **and** `FORCE ROW LEVEL SECURITY`.
- Read policies use `USING`; write policies use both `USING` and `WITH CHECK`.
- One policy per verb per role — no compound `FOR ALL` policies.
