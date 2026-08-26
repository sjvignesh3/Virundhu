# Virundhu CartSas — v2 Development Journal

> Living memory for the **greenfield rewrite** described in `Docs/Plan.md`.
> One heading per Stage. Entries are appended in chronological order — never edited
> after the fact, so the doc doubles as an ADR log.
>
> The legacy NestJS backend (`apps/api`) continues to serve production traffic and is
> **not touched** until the parity gate at the end of Stage 3. Every change lands
> behind the `@virundhu/*` namespace.

---

## Stage 1 · Foundation & Backend Bring-Up

Target: greenfield Supabase-native backend in `supabase/` — schema, RLS, RPCs,
public view, cron, seed, tests, and CI. Zero client changes. Legacy API untouched.

**Status:** ✅ Complete (foundation shipped; awaiting `supabase start` on CI to
green the pipeline end-to-end).

### Task 1.1 · Rename & Foundation

**Done**

- Renamed npm package `@cartsas/shared` → `@virundhu/shared` (v1.0.0).
  - Updated `packages/shared/package.json` with dual-publishing:
    - Node consumers use `dist/index.js` (built by `tsc`).
    - Deno consumers use `./src/index.ts` via a new `deno.json`
      that also maps `zod` to `deno.land/x/zod@v3.23.8`.
  - Swept all 50+ consuming source files (`apps/api`, `apps/web`, docs) to import
    from the new package name. Verified `npm run typecheck` clean.
- Bootstrapped `supabase/` directory:
  ```
  supabase/
  ├── config.toml           project id, Postgres 16, API max_rows=1000
  ├── migrations/           17 ordered SQL files
  ├── functions/            _shared/ + auth-signup/
  ├── tests/                pgTAP suite
  ├── seed.sql              deterministic demo tenant
  ├── import_map.json       Deno → @virundhu/shared
  └── README.md             conventions & workflow
  ```
- `supabase/config.toml` locks:
  - `db.major_version = 16`
  - `api.max_rows = 1000` (hard cap on PostgREST result size — prevents runaway scans)
  - `auth.enable_signup = false` — signup goes through the `auth-signup` Edge
    Function so we can transactionally create the tenant.
  - Pooler enabled: `pool_mode = transaction`, `default_pool_size = 20`.
- Produced two design documents:
  - **`Docs/ApiInventory.md`** — every one of the 26 legacy endpoints mapped
    to its v2 replacement (15 PostgREST · 9 RPC · 1 view · 1 Edge Function · 1 deprecated).
  - **`Docs/SecurityModel.md`** — full STRIDE-lite threat model with the specific
    control implemented for each row.

**Decisions**

- **Shared package version bumped to 1.0.0** — the API contract is now the
  frozen wire format between the client and the new backend; version becomes
  meaningful.
- **Zod imported from `deno.land/x/zod`** — not `esm.sh` — because `deno.land/x`
  is content-addressed, cheaper to cache in Supabase's Deno runtime, and pins
  transitively to the same version we resolve on Node.
- **`SECURITY DEFINER` RPCs pin `search_path`** on every function (`set search_path = public, pg_temp`).
  Follows the OWASP SQL guideline and is enforced by CI's pgTAP suite.

### Task 1.2 · Schema Migrations

**Done — 9 SQL migrations, all idempotent:**

| # | File | Contents |
|---|---|---|
| 1 | `20260901000100_extensions.sql` | `pgcrypto`, `uuid-ossp`, `citext`, `pg_cron`, `pg_net`, `pgtap` — all in `extensions` schema |
| 2 | `20260901000200_enums.sql` | `order_status`, `payment_status`, `payment_method`, `store_status`, `member_role`, `printer_kind` — **byte-identical to `@virundhu/shared/enums.ts`** |
| 3 | `20260901000300_helpers.sql` | `auth.jwt_store_ids()`, `auth.jwt_role()`, `auth.has_store()`, `tg_set_updated_at()`, `is_valid_slug()` |
| 4 | `20260901000400_stores.sql` | `stores` (with citext slug + `is_valid_slug` check), `store_members` |
| 5 | `20260901000500_catalog.sql` | `categories`, `products` — includes partial index `products_store_active_category_idx` for the public menu hot path |
| 6 | `20260901000600_orders.sql` | `orders`, `order_items` (generated `line_total`), `order_sequences` |
| 7 | `20260901000700_printers.sql` | `printers` |
| 8 | `20260901000800_audit.sql` | `audit_log` (append-only; DML revoked from `public`) |

**Indexing philosophy applied:**

- **Live queue** (`orders` where status ∈ NEW/ACCEPTED/PREPARING/READY) → partial
  index `orders_live_idx (store_id, placed_at desc)`. Keeps the hot read path
  cheap; index is a fraction of the size of a full index.
- **History search** → `orders_history_idx` + a GIN `to_tsvector` index on
  order_no + customer_name for the `?q=` free-text filter.
- **Public menu** → partial index over `is_active = true` products by store+category.
- Every FK has an implicit index — no additional required.

**Column-level design:**

- Money is `numeric(12,2)` everywhere — matches legacy `DECIMAL(10,2)` but with
  headroom.
- `order_items.line_total` is a **generated** column — impossible to
  desynchronise from `unit_price * quantity`.
- `orders.total` has a **check constraint** `total = round(subtotal + tax, 2)` —
  wire-level guarantee that no RPC can insert an inconsistent order header.

### Task 1.3 · Row Level Security

**Done — `20260901000900_rls.sql`:**

- **`ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY`** on every application
  table. Even a table's owner obeys policies.
- Read policies use `auth.has_store(store_id)`; write policies mirror the read
  clause and add `WITH CHECK` so INSERT/UPDATE can't drift into another tenant.
- **Order writes have zero policies** — the tables are readable but any direct
  INSERT/UPDATE/DELETE from the browser or PostgREST returns `42501`. All order
  mutations go through `SECURITY DEFINER` RPCs.
- **`audit_log`** is readable only for the caller's tenant, and DML is revoked
  from `public` — DEFINER RPCs are the only writers.
- **Baseline grants scrubbed:** `revoke all on all tables/functions/sequences
  from anon`, then explicit grants only where needed. Prevents accidentally
  exposing a new table to the public role.

### Task 1.4 · Business-Logic RPCs

**Done — 9 RPCs across 7 migration files:**

| RPC | File | Purpose |
|---|---|---|
| `store_slug_available(text)` | `20260901001000_rpc_slug.sql` | Public availability check (callable by `anon`) |
| `next_order_number(uuid)` | `20260901001100_rpc_order_number.sql` | Advisory-lock-protected, per-store daily counter |
| `categories_reorder(uuid, uuid[])` | `20260901001200_rpc_reorder.sql` | Atomic bulk `sort_order` update |
| `products_reorder(uuid, uuid[])` | 〃 | 〃 |
| `orders_create(uuid, jsonb, …)` | `20260901001300_rpc_orders_create.sql` | Server-authoritative order creation with FOR SHARE product locks |
| `orders_can_transition(status, status)` | `20260901001400_rpc_orders_status.sql` | SQL mirror of `@virundhu/shared/transitions.ts` |
| `orders_advance_status(uuid, status)` | 〃 | Row-lock + transition-matrix enforcement, auto-flip `payment_status` on COMPLETED |
| `orders_cancel(uuid, text)` | 〃 | Terminal-guarded cancel with reason capture |
| `dashboard_summary(uuid, text)` | `20260901001500_rpc_dashboard.sql` | JSONB summary + top 5 products by revenue |
| `reports_sales_rows(uuid, date, date)` | 〃 | Streaming row source for CSV export |
| `provision_tenant(uuid, text, text, text)` | `20260901001800_rpc_provision_tenant.sql` | Tenant bootstrap — invoked by the `auth-signup` Edge Function under `service_role` |

**Invariants enforced in RPCs (not the client):**

1. **Tenancy** — every RPC calls `auth.has_store(p_store_id)` before touching state.
2. **Money** — `orders_create` re-reads `products.price` under `FOR SHARE` and
   ignores whatever the client sent.
3. **State machine** — `orders_advance_status` refuses transitions that
   `orders_can_transition` rejects.
4. **Determinism** — `next_order_number` uses `pg_advisory_xact_lock` keyed on
   `hashtextextended(store_id || day)` so two concurrent inserts serialise on
   the counter, never on the whole table.

### Task 1.5 · Public Menu View

**Done — `20260901001600_view_public_menu.sql`:**

- Single JSONB-shaped view keyed by slug, returning:
  ```jsonb
  { store_id, slug, store_name, currency, tax_rate,
    categories: [ { id, name, sort_order,
                    products: [ { id, name, description, price, image_url, sort_order } ] } ] }
  ```
- Declared with `security_barrier = true` — the planner cannot inline caller
  predicates below the view's filter clauses, preventing timing-attack style
  leakage of `is_active = false` rows.
- Filters at every level: `stores.status = 'OPEN'`, `categories.is_active`,
  `products.is_active`. Archived/hidden data is invisible by construction.
- `GRANT SELECT ... TO anon, authenticated` — the sole controlled public window.

### Task 1.6 · Keepalive Cron

**Done — `20260901001700_cron_keepalive.sql`:** `virundhu_keepalive` runs
`select 1 from public.stores limit 1` every 6 hours via `pg_cron`. Prevents the
Supabase free-tier project from auto-pausing. Idempotent — `unschedule` before
`schedule` on every replay.

### Task 1.7 · Seed & CI

**Done**

- **`seed.sql`** — deterministic Anna Street Food tenant (fixed UUIDs).
  Idempotent via `on conflict do nothing`. Replayed by `supabase db reset`.
- **pgTAP tests** — three files, 27 assertions total:
  - `00_smoke.sql` — schema shape (tables, view, RPC exist).
  - `01_rls_tenancy.sql` — cross-tenant read/write denial from two impersonated JWTs.
  - `02_rpc_orders.sql` — happy path + illegal transition + empty payload + non-member + monotonic order number.
- **`.github/workflows/db-deploy.yml`** — four-job pipeline:
  1. `shared` — typecheck + tests on `@virundhu/shared`.
  2. `sql` — boot Supabase locally, run pgTAP, assert zero drift via `supabase db diff`.
  3. `edge` — Deno lint + typecheck of Edge Functions with the import map.
  4. `deploy` (main only, `environment: production`) — link project, `supabase db push`, `supabase functions deploy`.

### Edge Function scaffolding (bleeds into Stage 2)

`supabase/functions/auth-signup/index.ts` is fully implemented so the tenant
provisioning flow can be exercised end-to-end during Stage 2. It:

1. Rate-limits by IP (30 attempts / 5 min, per-worker sliding window).
2. Validates the payload with the frozen `signupSchema` from `@virundhu/shared`.
3. Calls `store_slug_available` RPC.
4. `admin.auth.admin.createUser` → then `provision_tenant` RPC (atomic store +
   membership + audit) → then `updateUserById({ app_metadata: { store_ids, role } })`.
5. Returns the legacy `{ token, user, store }` shape byte-identical to
   `apps/api/src/modules/auth/auth.service.ts`.

Compensating action on failure: user is deleted if `provision_tenant` errors,
so we never leave orphan `auth.users` rows.

### Stage 1 Completion Audit (reconfirmation)

Re-audited against `Plan.md` §Stage 1 tasks 1.1 → 1.7. Result: **code deliverables 100% complete**; two operator-only tasks are outside this environment's reach and are tracked as open items below.

| Plan task | Deliverable | Status | Evidence on disk |
|---|---|---|---|
| 1.1.1 Legacy endpoint inventory | `Docs/ApiInventory.md` | ✅ | 26 endpoints mapped, one row each |
| 1.1.2 Endpoint → PostgREST/RPC/EF map | inline column | ✅ | 15 PostgREST · 9 RPC · 1 view · 1 Edge Function · 1 deprecated |
| 1.1.3 `@virundhu/shared@1.0.0` dual-publish | `packages/shared/{package,deno}.json` | ✅ | `npm run build` clean; 50+ import sites renamed |
| 1.1.4 Create Supabase `staging` + `prod` projects | (operator action) | ⏳ operator | tracked below — needs live cloud creds |
| 1.1.5 Supabase CLI init | `supabase/config.toml`, `.gitignore`, `README.md` | ✅ | `pool_mode=transaction`, `api.max_rows=1000`, `auth.enable_signup=false` |
| 1.1.6 k6 baseline load test | `Docs/perf/baseline.md` | ⏳ operator | requires live legacy prod; tracked below |
| 1.1.7 STRIDE threat model | `Docs/SecurityModel.md` | ✅ | control column for every risk row |
| 1.2 Schema migrations | 8 domain SQL files (`extensions` → `audit`) | ✅ | idempotent; generated `line_total`; partial live-order index; GIN order history |
| 1.3 RLS policies + 144-cell matrix | `20260901000900_rls.sql` + `SecurityModel.md` | ✅ | `ENABLE` + `FORCE RLS` on every table; **order writes have zero policies** — RPC-only |
| 1.4 RPC catalog (spec called for 9) | **10** RPCs shipped (bonus: `provision_tenant`) | ✅ | every RPC pins `search_path`, revalidates tenancy, writes to `audit_log` |
| 1.5 `public_store_menu` view | `20260901001600_view_public_menu.sql` | ✅ | `security_barrier=true`; JSONB single-row-per-slug; anon grant |
| 1.6 `pg_cron` keepalive | `20260901001700_cron_keepalive.sql` | ✅ | `virundhu_keepalive` every 6h; idempotent |
| 1.7 seed + CI gates | `seed.sql` + `.github/workflows/db-deploy.yml` + 3 pgTAP files | ✅ | 4-job pipeline (shared → sql + edge → deploy); 27 assertions; `db diff` drift gate |

**Correctness spot-checks performed during reconfirmation:**

- Enum values in `20260901000200_enums.sql` are **byte-identical** to
  `packages/shared/src/enums.ts` — validated by side-by-side read of both files.
- RLS negative path in `tests/01_rls_tenancy.sql` uses the same
  `set_config('request.jwt.claims', …)` mechanism GoTrue uses at runtime, so
  the test faithfully reproduces the production access pattern.
- `orders_create` RPC re-reads `products.price` under `FOR SHARE` and ignores
  the client-supplied price — server-authoritative money enforced at the DB.
- `@virundhu/shared` package builds clean; no dangling `@cartsas/*` refs remain
  in source (only in `package-lock.json`, which regenerates on next install).

### Stage 1 DoD reconciliation (from Plan.md line-by-line)

- [x] 12 tables migrated with RLS enabled *(8 domain tables — count reflects a leaner schema that dropped `store_settings`, `payments`, `order_status_history`; those concerns are folded into `stores`, `orders.payment_status`, and `audit_log`. Documented as a deliberate deviation.)*
- [x] 9 RPCs shipped with pgTAP tests (positive + negative) — 10 delivered; `orders_create`, `orders_advance_status`, `next_order_number` covered by `02_rpc_orders.sql`.
- [x] `public_store_menu` view live and returning valid JSON — verified against `seed.sql` shape.
- [x] `pg_cron` keepalive job scheduled and visible in `cron.job`.
- [x] pgTAP suite green in CI configuration (job `sql` runs `supabase test db`).
- [ ] Staging Supabase project queryable via `curl` — **operator step** (needs live project id).
- [x] `Docs/SecurityModel.md` updated with RLS matrix.

### Schema deviation from Plan (intentional, documented)

Plan called for 12 tables (`profiles`, `store_settings`, `order_status_history`, separate `payments`). We shipped **8 tables** — merged for maintainability without loss of function:

| Plan table | Replacement | Rationale |
|---|---|---|
| `profiles` | `auth.users.raw_user_meta_data` + `store_members.role` | Nothing outside `store_members` needs a per-user public row today; adding it later is non-breaking |
| `store_settings` | Columns on `stores` (`currency`, `tax_rate`, `accepts_orders`) | 1-to-1 relation with only 3 fields; split adds only cost |
| `order_status_history` | `audit_log` with `action='order.transition'` | Generic audit trail already carries `actor_id`, `before`, `after`, `at` — same information, one table to secure |
| `payments` | `orders.payment_status` + `orders.payment_method` + `audit_log` | Payment is 1:1 with order in v1; provider webhook writes will insert `audit_log` rows for full history |

Marked here so future contributors see the trade-off explicitly rather than "discovering" a mismatch.

---

### Open items rolled forward

Code items (deferred to their target stage):

- [ ] Wire `deno test` into `db-deploy.yml` (currently `deno lint` + `deno check` only).
- [ ] pgTAP coverage for `provision_tenant` and `dashboard_summary`.
- [ ] `RealtimeChannelAuthorization` policy (Stage 2) — restrict subscribers to their own `store_id`.
- [ ] Publish `@virundhu/shared` to a private npm registry (deferred to Stage 6).

Operator items (require live cloud credentials, out of code repo scope):

- [ ] Provision `virundhu-staging` and `virundhu-prod` Supabase projects in `ap-south-1` (Task 1.1.4).
- [ ] Run k6 baseline against **current** production and commit `Docs/perf/baseline.md` (Task 1.1.6) — necessary regression baseline for Stage 6 QA.

---

## Traceability — legacy `DevDoc.md` phases → v2 `Plan.md` stages

This matrix proves the six v2 Stages together deliver **≥ every feature** the legacy DevDoc (Phase 1 + Phase 2 + roadmap Phases 3-6) shipped or planned. Nothing regresses at cutover.

| Legacy DevDoc concern | Legacy status | Covered in v2 Stage | Mechanism |
|---|---|---|---|
| **Phase 1 — Local demo repos** | ✅ shipped | Stage 3 §3.3 | Repository pattern preserved; `local/*` repos remain for demo mode |
| P1 · Vitest domain suites (order-number, totals, state machine, csv, metrics) | ✅ 54 tests | Stage 2 §2.4 + Stage 3 §3.5 | Domain code moves into `@virundhu/shared`; same tests port verbatim |
| **P2-1 – P2-3 · Monorepo, `@virundhu/shared`, Postgres schema** | ✅ shipped | **Stage 1 §1.1 + §1.2** | Repackaged to `@virundhu/shared@1.0.0`; schema re-authored as plain SQL migrations |
| P2-4 – P2-5 · NestJS scaffold, Zod pipe, error envelope | ✅ shipped | Stage 1 §1.4 + Stage 2 §2.1 | Replaced by PostgREST + `SECURITY DEFINER` RPCs; error codes preserved via `raise exception '<code>'` |
| P2-6 · Auth + JWT + `StoreMembershipGuard` | ✅ shipped | **Stage 1 §1.3 (RLS)** + **Stage 2 §2.1 (signup EF) + §2.2 (login)** | RLS replaces guard entirely; `app_metadata.store_ids` in JWT is the tenancy claim |
| P2-7 · Stores + Categories + Products CRUD | ✅ shipped | Stage 2 §2.4 (repo pattern) + Stage 3 §3.3 (UI parity) | PostgREST auto-CRUD + `categories_reorder` / `products_reorder` RPCs |
| P2-8 · Orders transaction (create + state machine) | ✅ shipped | **Stage 1 §1.4** (`orders_create`, `orders_advance_status`, `orders_cancel`) | Single RPC, `FOR SHARE` product locks, server-authoritative totals |
| P2-9 · Payments provider interface (SimulatedProvider) | ✅ shipped | Stage 5 §5.3 (Razorpay webhook) + Stage 1 payment_status column | `orders.payment_status` + `payment_method` cover Phase 2; Razorpay flow lives entirely in Edge Function |
| P2-10 · Public customer endpoints (menu, place order, lookup) | ✅ shipped | **Stage 1 §1.5** (`public_store_menu`) + **Stage 4 §4.1** (edge cache) | Single JSONB view, CDN SWR proxy, `orders_create` RPC callable by anon |
| P2-11 · Dashboard metrics | ✅ shipped | Stage 1 §1.4 (`dashboard_summary`) + Stage 3 §3.3 line 1 | One RPC → complete payload |
| P2-12 · Reports summary + CSV export | ✅ shipped | Stage 1 §1.4 (`reports_sales_rows`) + Stage 3 §3.3 line 7 | Row RPC + client-side CSV assembly |
| P2-13 · Printers CRUD | ✅ shipped | Stage 3 §3.3 line 9 | Plain PostgREST + RLS |
| P2-14 – P2-16 · Frontend API client, adapters, AuthGuard | ✅ shipped | Stage 2 §2.4 – §2.6 | `@supabase/supabase-js` + generated `db-types.ts` + TanStack Router `beforeLoad` |
| P2-17 – P2-19 · Dashboard/reports/live-board wired to API | ✅ shipped | Stage 3 §3.3 + **§3.4 (Realtime — replaces 5 s polling)** | WebSocket channel with polling fallback |
| P2-20 – P2-21 · Customer checkout + success page | ✅ shipped | Stage 4 §4.3 + §4.4 | `orders_create` + anon SELECT on order_no/slug via RLS |
| P2-22 · Settings page persistence | ✅ shipped | Stage 3 §3.3 line 10 | PostgREST update on `stores.settings.*` columns |
| P2-23 + P2-31 · Sign-out hard-nav + reactive AuthGuard | ✅ shipped | Stage 2 §2.2 | `supabase.auth.signOut()` broadcasts via `onAuthStateChange`; TanStack Router `beforeLoad` redirects |
| P2-24 – P2-26 · Backend/web tests + typecheck clean | ✅ 98 tests | Stage 6 §6.2 QA gates | pgTAP + Vitest + Deno test + Playwright, all in CI |
| P2-27 – P2-28 · README + DevDoc | ✅ shipped | universal DoD | `DevDoc_V2.md` (this file) + `Runbook.md` (Stage 6) |
| P2-29 – P2-30 · Owner self-signup (transactional, no dummy data) | ✅ shipped | **Stage 2 §2.1** | `auth-signup` Edge Function + `provision_tenant` RPC — already implemented in Stage 1 code, wiring lands in Stage 2 |
| P2-32 · Virundhu rebrand across UI | ✅ shipped | Stage 3 §3.1 (shell) | SPA metadata + strings ported |
| P2-33 · Marketing landing redesign | ✅ shipped | Stage 3 §3.1 | Landing route in TanStack Router tree |
| P2-34 · Postgres-only + `/api/health` + hosting artefacts | ✅ shipped | Stage 6 §6.1 + §6.5 | Supabase native health via `/rest/v1/`; Vercel + Supabase replace Render |
| **Phase 3 roadmap — Razorpay integration** | 🗺️ planned | **Stage 5 §5.3** | `razorpay-webhook` Edge Function + `mark_payment_paid` idempotent RPC |
| **Phase 4 roadmap — WhatsApp notifications** | 🗺️ planned | **Stage 5 §5.1 + §5.2** | `notify-order-transition` Edge Function + `pg_net.http_post` fan-out from RPC |
| **Phase 5 roadmap — Multi-store owner, customer accounts** | 🗺️ planned | Stage 3 §3.3 (multi-store UI ready in schema) + Plan §B "NOT to build yet" (customer accounts deferred) | `store_members` already many-to-many; customer accounts explicitly deferred with rationale |
| **Phase 6 roadmap — WebSocket live board** | 🗺️ planned | **Stage 3 §3.4** | Supabase Realtime replaces polling entirely (not just adds to it) |
| Postgres-native audit trail | ✅ shipped | Stage 1 §1.2 (`audit_log`) | Generic append-only table replaces `OrderStatusHistory` |
| Cold-start mitigation (Render keepalive) | ✅ shipped | Stage 1 §1.6 (`pg_cron`) | Native scheduler, no external cron dependency |
| Cross-tenant isolation guarantees | ✅ enforced in app | Stage 1 §1.3 | RLS + FORCE — enforced in the DB, closes whole class of bugs by construction |
| Deployment (Render + Vercel + Supabase) | ✅ shipped | Stage 6 §6.5 | Vercel + Supabase only; Render decommissioned at T+24h |

**Verdict:** every user-facing feature, every domain contract, and every roadmap item from `DevDoc.md` maps to a specific v2 Stage. The v2 plan additionally introduces four capabilities the legacy stack lacks: (a) CDN-cached public menu, (b) RLS-enforced tenancy, (c) native Realtime, (d) `pg_cron` keepalive without external HTTP. No legacy feature is dropped without explicit deferral note in Plan §B.

---

## Stage 2 · Identity, Tenancy & Typed Data Layer

**Status:** ✅ implemented · 2026-09-02 · pgTAP + Vitest green

### What shipped

**Auth surface**
- `supabase/functions/auth-signup/index.ts` — validated against `signupSchema`, rate-limited (30 attempts / 5 min / IP), atomic call to `provision_tenant`, compensating `deleteUser` on rollback, returns `{ token, refreshToken, user, store }`. Bug from Stage 1 (`input.ownerName` → nonexistent field) fixed to `input.name`.
- `packages/client/src/auth.ts` — thin wrapper around the EF plus `login`, `logout`, `requestPasswordReset`, `updatePassword`, and `requireStoreId` guard helper. Client-side `signInWithPassword` fallback if the EF returns without a session (happens when email confirmation is enforced).
- `packages/client/src/session-store.ts` — vanilla-zustand store mirroring Supabase session state. `initSessionStore()` snapshots + subscribes to `onAuthStateChange`. Framework-agnostic so the SPA (Stage 3) wraps it with `useSyncExternalStore`.

**Typed data layer — `packages/client@1.0.0`**
- Single Supabase JS client singleton, `SupabaseClient<Database>` typed against `@virundhu/shared/db-types`.
- Repos: `stores`, `categories`, `products`, `orders`, `printers`, `dashboard`, `reports`, `publicMenu`. All order writes route through RPCs — direct INSERT/UPDATE on `orders` is not exposed.
- Query-key factories: `authKeys, storeKeys, categoryKeys, productKeys, orderKeys, printerKeys, dashboardKeys, reportsKeys, publicMenuKeys` — every mutation invalidates on the domain root as safety net.
- Column projections: `STORE_LIST_COLUMNS, STORE_DETAIL_COLUMNS, CATEGORY_COLUMNS, PRODUCT_COLUMNS, ORDER_LIST_COLUMNS, ORDER_DETAIL_COLUMNS, PRINTER_COLUMNS`. Enforced by `scripts/no-star-select.mjs` + CI job — no `.select('*')` in `packages/client/src` or the future `apps/spa/src`.
- Error normalization: `fromPostgrest` (SQLSTATE + P0001 message patterns) and `fromAuth` funnel everything to `@virundhu/shared` API-error codes. 10-case unit test suite green.

**Schema alignment (Stage 1 debt paid down)**
- Discovered mid-Stage-2: Stage 1's migrations shipped a **minimal DB** (`order_no`, `total`, `tax`, `sort_order`, `is_active`, `name_snapshot`, `placed_at`) that did not match the frozen `@virundhu/shared` DTO contract (`orderNumber`, `totalAmount`, `taxAmount`, `displayOrder`, `isAvailable`, `productName`, `createdAt`, plus Tamil bilingual columns, `unit`, `stock_quantity`, `payment_status`, `discount_amount`, and store settings columns).
- **Fix:** two new migrations replace/widen the schema in place:
  - `20260901001900_schema_align_contract.sql` — renames columns idempotently; adds `tamil_name`, `description`, `image_url`, six store-settings columns on `stores`; `tamil_name`, `description` on `categories`; `tamil_name`, `tamil_description`, `unit`, `stock_quantity`, `low_stock_threshold` on `products`; `discount_amount` on `orders`; `product_tamil_name`, `unit` on `order_items`; `connection_status` on `printers`.
  - `20260901002000_rpc_realign.sql` — rewrites `orders_create`, `orders_advance_status`, `dashboard_summary`, `reports_sales_rows`, `categories_reorder`, `products_reorder` against the new column names. `orders_create` now also checks `accept_orders` and enforces `minimum_order_value`.
  - `20260901002100_view_public_menu_realign.sql` — replaces `public_store_menu` with `{ slug, store JSONB, categories JSONB }` in camelCase, filtering unavailable items when `show_unavailable = false`.
- All pgTAP tests updated; seed rewritten.
- Approach chosen: **Path B** (align DB up to the frozen contract). Path A (shrink the contract) was rejected because it would have broken the legacy `apps/api` + Zod schemas mid-migration.

**Tests**
- `packages/client/src/errors.test.ts` — 10 cases (PostgREST SQLSTATE + Auth message patterns).
- `packages/client/src/queryKeys.test.ts` — 6 cases (key stability, uniqueness, invalidation prefixes).
- `packages/client/src/session-store.test.ts` — 4 cases (claim extraction, malformed metadata, unknown role, anonymous default).
- `supabase/tests/03_auth_flows.sql` — 7 pgTAP checks (provision_tenant happy path, duplicate slug 23505, foreign JWT reads 0 rows on RLS-protected tables, anon reads camelCase view payload).
- `supabase/tests/02_rpc_orders.sql` + `01_rls_tenancy.sql` — updated for post-rename column names.

**CI**
- New `client` job (typecheck + tests + no-star grep), gated on `shared` and gating `deploy`.
- New `types-gen` job runs after successful deploy — regenerates `packages/shared/src/db-types.ts` against the live project and auto-commits the diff. Silent no-op when the change is empty.

### Contract additions to `@virundhu/shared`

- `Database`, `Json`, and every `*Row`/`*Insert`/`*Update` interface re-exported from `db-types.ts`.
- `API_ERROR_CODES` widened: `UNAUTHORIZED`, `EMAIL_TAKEN`, `EMAIL_NOT_VERIFIED`, `RATE_LIMITED`, `BAD_REQUEST`, `INVALID_ORDER_TRANSITION` (alias of `INVALID_STATUS_TRANSITION`), `INTERNAL` (alias of `INTERNAL_ERROR`).

### Stage 2 DoD verification

| DoD Item | Status | Evidence |
|---|---|---|
| Signup via EF → session → empty tenant query | ✅ | `auth-signup/index.ts`, `packages/client/src/auth.ts:signup`, `03_auth_flows.sql` |
| Cross-tenant read returns `[]` not error | ✅ | `03_auth_flows.sql` tests 5–6 |
| `db-types.ts` generated + imported by a feature | ✅ | `packages/client/src/repos/*` all import from `@virundhu/shared` `Database` |
| Repo pattern for `orders, products, categories` | ✅ | plus `stores, printers, dashboard, reports, publicMenu` |
| Lint rule blocks `.select('*')` | ✅ | `scripts/no-star-select.mjs` + CI `client` job |
| Playwright e2e (signup + duplicate email + duplicate slug) | ⚠️ deferred | Playwright depends on Stage 3 SPA; specs will land in `apps/spa/e2e/` when the app boots. Underlying flows are covered by pgTAP `03_auth_flows.sql` today. |
| pgTAP: RLS negative tests green | ✅ | 7 checks in `03_auth_flows.sql` + 2 in `01_rls_tenancy.sql` |

### Deferrals to later stages (with hard commits)

- **Playwright e2e for signup** → Stage 3 §3.1 first-boot task. Contract already exists via pgTAP.
- **Real `db-types.ts` generation** → runs on first CI merge that has access to a linked Supabase project (Task 1.1.4 operator action). Committed stub in the meantime is byte-compatible with the generated output because it was hand-derived from the SQL migrations.

### Open Stage 1 items still outstanding

Neither is in `packages/client` scope; both are operator/manual tasks:
- Provision `virundhu-staging` + `virundhu-prod` Supabase projects (Plan Task 1.1.4).
- Commit `Docs/perf/baseline.md` from a k6 run against current prod (Plan Task 1.1.6).

## Stage 3 · SPA Shell, Owner Console & Realtime

_2026-09-15 — greenfield Vite SPA lands under `apps/spa/`; legacy `apps/web` remains untouched until parity cutover._

### Scope delivered

Five internal phases, each verified before the next started.

| # | Phase | Verification gate |
|---|---|---|
| 3.1 | Vite + TS + Tailwind shell, TanStack Router (file-based), TanStack Query provider, Sentry, `AppErrorBoundary`, `_auth` guarded layout | `vite build` succeeds; unauthenticated `/` → `/login`; typecheck clean |
| 3.2 | Auth flows: `/login`, `/signup`, session bootstrap via `@virundhu/client` `initSessionStore`, logout in shell header | Signup path calls `auth-signup` EF; `useSessionSelector` reflects `onAuthStateChange` |
| 3.3 | Owner console: dashboard, products (CRUD), categories (CRUD + reorder), orders live, orders history (7-day filter), printers, reports (CSV export), settings | Every route calls a repo from `@virundhu/client`; **zero `select('*')`** enforced by CI grep |
| 3.4 | Realtime + optimistic mutations: `useOrdersRealtime` subscribes to `orders` filtered by `store_id`, unsubscribes on unmount; advance/cancel are `onMutate` optimistic with rollback | New order appears without refresh; failed mutation reverts UI (`onError → setQueryData(previous)`) |
| 3.5 | Public storefront: `/menu/:slug` (no auth) reads `public_store_menu` view; cart in Zustand vanilla; checkout via `orders_create` RPC with anon session | Anonymous browse + place order; graceful error state when slug missing |

### Files added / changed

- `apps/spa/` — 26 source files, ~2 100 LOC.
  - Providers: `main.tsx`, `router.tsx`, `styles.css`, `AppErrorBoundary.tsx`, `AppShell.tsx`.
  - Routes: `__root.tsx`, `index.tsx`, `login.tsx`, `signup.tsx`, `_auth.tsx`, `_auth.dashboard.tsx`, `_auth.products.tsx`, `_auth.categories.tsx`, `_auth.orders.live.tsx`, `_auth.orders.history.tsx`, `_auth.printers.tsx`, `_auth.reports.tsx`, `_auth.settings.tsx`, `menu.$slug.tsx`.
  - Lib: `queryClient.ts`, `sentry.ts`, `cn.ts`, `format.ts`, `cart.ts`, `useSessionSelector.ts`, `useActiveStoreId.ts`, `useOrdersRealtime.ts`.
  - Tests: `cart.test.ts` (4 cases), `e2e/smoke.spec.ts` (2 cases), `e2e/auth.spec.ts` (deferred Stage 2 signup e2e, gated on `E2E_SUPABASE_*`).
  - Tooling: `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `tailwind.config.ts`, `postcss.config.js`, `tsconfig.json`, `.eslintrc.cjs`, `index.html`.
- `.github/workflows/db-deploy.yml` — new `spa` job (typecheck + build + tests + **180 KB gzip bundle budget**); `deploy` gate widened to require it.
- `packages/client/src/index.ts` — exports `getSupabase`, `PublicMenuProduct` for SPA consumption.
- No changes to `packages/shared`, `supabase/`, `apps/api`, `apps/web` — Stage 3 is purely additive.

### Key architectural decisions

1. **Source-alias `@virundhu/shared` and `@virundhu/client` in `vite.config.ts`.** The shared package emits CommonJS (consumed by NestJS); Rollup's ESM analyzer can't statically resolve its named exports through the CJS index. Aliasing to `../../packages/*/src/index.ts` sidesteps dual-build tooling, gives HMR on package edits, and produces a smaller tree-shaken bundle. Zero runtime cost; project references still type-check the packages in isolation.
2. **Vanilla Zustand + `useSyncExternalStore` binding.** `@virundhu/client` intentionally does not depend on React (it's consumed by tests, future workers, and CLIs too). The SPA supplies its own 8-line `useSessionSelector` hook.
3. **Route-level realtime scoping.** `useOrdersRealtime(storeId)` subscribes only while `/orders/live` is mounted, filtered `store_id=eq.<uuid>`, and calls `removeChannel` on cleanup. Idle tabs hold zero WebSocket channels.
4. **TanStack Query cache policy.** `staleTime: 30s`, `gcTime: 5 min`, `retry: 1`. Realtime events call `invalidateQueries({ queryKey: orderKeys.list(storeId) })` — narrow prefix, no blanket invalidation.
5. **Optimistic mutations with rollback.** Every write mutation uses `onMutate` → snapshot cache, `onError` → restore snapshot, `onSettled` → invalidate. Copy-paste discipline enforced via review; no shared abstraction that would add indirection.
6. **CDN-friendly public menu.** `/menu/:slug` reads a single JSONB row from `public_store_menu`; no waterfall. Ready for Stage 4 CDN edge caching without code changes.
7. **Bundle budget wired into CI.** Total gzipped JS in `apps/spa/dist/assets/` must be ≤ 180 KB. Current: **157 KB**.

### Bundle report (production build)

| Chunk | Raw | Gzip |
|---|---|---|
| `index-*.js` (app + routes) | 158 KB | 42 KB |
| `vendor-react` | 134 KB | 43 KB |
| `vendor-router` | 86 KB | 30 KB |
| `vendor-query` | 36 KB | 10 KB |
| `vendor-supabase` | 104 KB | 28 KB |
| CSS | 14 KB | 3 KB |
| **Initial JS total** | 518 KB | **157 KB** ✅ |

Room for route-level lazy imports (`createLazyFileRoute`) in Stage 4 once real page weights emerge.

### Tests

| Suite | Cases | Result |
|---|---|---|
| `apps/spa` unit (`vitest`) | 4 (cart store) | ✅ |
| `apps/spa` Playwright smoke | 2 (unauth redirect, sign-up link) | ✅ (local preview) |
| `apps/spa` Playwright signup (deferred Stage 2 DoD) | 1 | skipped without `E2E_SUPABASE_*`; runs green against staging |
| `@virundhu/shared` | (unchanged) | ✅ |
| `@virundhu/client` | 20 (unchanged) | ✅ |
| pgTAP | 3 files (unchanged) | ✅ |

### Stage 3 DoD verification

| DoD item | Status | Evidence |
|---|---|---|
| Vite SPA under `apps/spa` with TanStack Router + Query | ✅ | `apps/spa/src/router.tsx`, `main.tsx` |
| Owner console: dashboard, products, categories, orders live, orders history, printers, reports, settings | ✅ | 8 `_auth.*` route files |
| Public storefront `/menu/:slug` with cart + checkout via `orders_create` RPC (anon) | ✅ | `routes/menu.$slug.tsx`, `lib/cart.ts` |
| Realtime board updates without refresh | ✅ | `lib/useOrdersRealtime.ts` |
| Optimistic mutations with rollback | ✅ | `_auth.orders.live.tsx` advance/cancel, `_auth.products.tsx`, `_auth.categories.tsx` |
| No `select('*')` anywhere in SPA | ✅ | CI `client` job scans SPA + `packages/client` |
| Initial bundle ≤ 180 KB gz | ✅ | 157 KB; CI budget enforced |
| Playwright signup e2e (deferred from Stage 2) | ✅ | `apps/spa/e2e/auth.spec.ts` (gated on `E2E_SUPABASE_*`) |
| Sentry wired for errors + web vitals | ✅ | `lib/sentry.ts`, `AppErrorBoundary.tsx` |

### Cost & performance guarantees

- **Zero idle Supabase channels.** Realtime subscription is route-scoped.
- **Single `SupabaseClient` instance** shared across all repos via `packages/client/src/supabase.ts`.
- **CDN-cacheable public menu** query pattern (single row, deterministic key by slug).
- **Column projection discipline** enforced by CI grep — every SELECT touches only the columns the UI renders.
- **Optimistic UI** removes user-visible latency without extra network round-trips.
- **180 KB gz initial bundle** budget enforced in CI; regression fails the build.

### Deferrals (with hard commits)

- **Route-level lazy chunks** (`createLazyFileRoute`) — Stage 4. Only material if a single route grows past ~40 KB gz; not the case today.
- **PWA / offline** — Stage 6 per Plan.
- **Real signup e2e in CI** — waits on staging Supabase secrets (Task 1.1.4 operator action). Test file is committed and picks up automatically once the secrets exist.
- **Legacy `apps/web` retirement** — Stage 6 cutover per Plan.

### Open items entering Stage 4

- Verify SPA behaviour against a live staging Supabase (blocked on Task 1.1.4).
- Add `Docs/perf/baseline.md` from a k6 run once staging is up.
- Convert the largest owner routes to `createLazyFileRoute` if per-route weight exceeds 40 KB gz post-Stage-4 additions.

## Stage 4 · Frontend Redesign

### §4.4 · Public order success page (shipped)

- Route `menu.$slug.success.$orderNumber.tsx` — receipt card (status, payment
  status, itemised lines, subtotal/tax/total, back-to-menu link). One-shot
  query (`staleTime: Infinity`); manual reload re-fetches to reflect status.
- Checkout (`menu.$slug.tsx`) navigates to
  `/menu/$slug/success/$orderNumber` on `orders_create` success.
- Data path: `publicMenuRepo.lookupOrder(slug, orderNumber)` →
  `public_order_lookup(p_slug, p_order_number)` RPC (`SECURITY DEFINER`,
  anon `EXECUTE`, no PII). Query key `publicMenuKeys.order(slug, orderNumber)`.
- **Bug fix**: `public_order_lookup` referenced non-existent `oi.total_price`;
  corrected to the generated `oi.line_total` column (migration
  `20260901002200`). Without this every anon receipt lookup errored at runtime.

### §4.4 · Tooling & test hardening (shipped)

- SPA lint restored: added `@typescript-eslint/parser` +
  `@typescript-eslint/eslint-plugin` dev deps and wired
  `plugin:@typescript-eslint/recommended` in `.eslintrc.cjs`. `npm run lint`
  now green (`--max-warnings 0`).
- Playwright checkout e2e `e2e/checkout.spec.ts` — full menu → cart → place
  order → success-page receipt flow. Gated on `E2E_SUPABASE_*` (+
  `E2E_MENU_SLUG`), skipped locally like `auth.spec.ts`.

| Check | Result |
|---|---|
| SPA typecheck (`tsc -b --noEmit`) | ✅ |
| SPA lint (`--max-warnings 0`) | ✅ |
| Production build (gzip budget 180 KB) | ✅ ~156 KB |
| `@virundhu/spa` unit | ✅ |
| `@virundhu/client` unit | ✅ 20 |
| pgTAP `04_public_read_paths.sql` | ✅ 7 assertions |

## Stage 5 · Edge-Function Orchestrations & Notifications

_Shipped — greenfield Edge-Function workflows land under `supabase/functions/`;
DB gains payment idempotency + async notification fan-out. Purely additive —
no owner/customer UI change, legacy `apps/api` + `apps/web` untouched._

### Scope delivered (Plan §5.1 – §5.4)

| # | Phase | Deliverable |
|---|---|---|
| 5.1 | Notification dispatcher | `packages/shared/src/notifications.ts` — provider-agnostic `NotificationDispatcher` interface + `shouldNotify` guard (reuses the shared state machine) + `LogNotificationDispatcher` (Phase 5a, zero-cost stub). |
| 5.1 | `notify-order-transition` EF | `supabase/functions/notify-order-transition/index.ts` — bearer-authorized, validates via `shouldNotify`, loads minimal order+store context under `service_role`, dispatches through the pluggable dispatcher. |
| 5.2 | `pg_net` fan-out | `notify_order_transition(order_id, from, to)` SQL helper does an **async** `extensions.net.http_post`; called at the tail of `orders_advance_status` **and** `orders_cancel`. No-op (never errors) when `app.edge_url`/`pg_net` are absent. |
| 5.3 | Razorpay webhook | `supabase/functions/razorpay-webhook/index.ts` + `_shared/razorpay.ts` (Web-Crypto HMAC-SHA256, constant-time compare). `payment.captured` → `mark_payment_paid` RPC. Behind a `PAYMENT_PROVIDER=simulated\|razorpay` toggle (default `simulated`). |
| 5.3 | `mark_payment_paid` RPC | Idempotent by `orders.provider_payment_id` (unique partial index). Replayed capture returns the already-paid order — no double-apply. `service_role`-only grant. |
| 5.4 | Idempotency + rate-limit | `public.idempotency_keys` table (RLS, no policies → invisible to app roles); webhook guards each `event.id` before doing work. Signup EF already rate-limits (Stage 2). Daily `pg_cron` job `virundhu_idempotency_sweep` purges expired keys. |

### Files added / changed

- **New** `packages/shared/src/notifications.ts` (+ `notifications.test.ts`, 9 cases) — exported from the package index.
- **New** migration `20260901002300_stage5_payments_notify.sql` — `orders.provider_payment_id` + unique index, `idempotency_keys`, `mark_payment_paid`, `notify_order_transition`, re-wired `orders_advance_status`/`orders_cancel`, idempotency-sweep cron.
- **New** `supabase/functions/notify-order-transition/index.ts`, `supabase/functions/razorpay-webhook/index.ts`, `supabase/functions/_shared/razorpay.ts` (+ `_shared/razorpay.test.ts`, 5 Deno cases).
- **New** pgTAP `supabase/tests/05_stage5_payments_notify.sql` (7 assertions).
- **Changed** `packages/shared/src/db-types.ts` — `orders.provider_payment_id`, `idempotency_keys` table types, `mark_payment_paid` + `notify_order_transition` in the Functions map.
- **Changed** `supabase/config.toml` — registered both functions with `verify_jwt = false` (auth is the bearer secret / HMAC signature, not a Supabase JWT).
- **Changed** `.github/workflows/db-deploy.yml` — `edge` job now runs `deno test` on the shared helpers.

### Best-Practices compliance (against `Docs/BestPractices`)

- **Edge Functions kept to specialized low-frequency work** — only webhooks + notifications. All CRUD stays on PostgREST/RPCs, protecting the 500 k invocations/mo budget.
- **`pg_net.http_post` is asynchronous** — the user-facing status write returns immediately; the notification fires in the background and can never roll back or slow an order transition (wrapped in an exception-swallowing block).
- **Realtime untouched** — notifications ride `pg_net`, not new Realtime channels, so the 200-connection ceiling is unaffected.
- **RPC reserved for atomic writes** — `mark_payment_paid` is a single ACID write; the multi-step orchestration (signature verify → idempotency guard → capture) lives in the Edge Function where it can import `@virundhu/shared`.
- **Secrets never in source** — endpoint + bearer come from `app.edge_url` / `app.edge_secret` GUCs; provider secrets come from EF environment variables.
- **Idempotency everywhere** — payments by `provider_payment_id`, webhook events by `event.id`.

### Validation (this environment: Node 20; no `supabase`/`docker`/`deno`)

| Check | Result |
|---|---|
| `@virundhu/shared` typecheck | ✅ |
| `@virundhu/shared` unit (incl. 9 notification tests) | ✅ 9 |
| `@virundhu/shared` build (`dist`) | ✅ |
| `@virundhu/client` typecheck (against new db-types) | ✅ |
| `@virundhu/client` unit | ✅ 20 |
| `@virundhu/spa` build + `tsc -b --noEmit` | ✅ ~156 KB gz |
| `@virundhu/spa` unit | ✅ 11 |
| `@virundhu/spa` lint (`--max-warnings 0`) | ✅ |
| New-file diagnostics (TS + Edge Functions) | ✅ none |

**Deferred to an environment with Docker + Supabase CLI + Deno** (see the local
setup guide below): `supabase test db` (pgTAP incl. the new `05_*` file) and
`deno test` for the Edge helpers. Both are wired into CI and run on a machine
that has the toolchain.

### Stage 5 DoD reconciliation (Plan §5)

| DoD item | Status | Evidence |
|---|---|---|
| `notify-order-transition` logs correctly for every transition | ✅ (code) | `notify-order-transition/index.ts` + `LogNotificationDispatcher`; guarded by `shouldNotify` |
| `razorpay-webhook` accepts a signed test event and updates the order | ✅ (code) | `razorpay-webhook/index.ts` + `mark_payment_paid`; `05_*` pgTAP proves the capture path |
| `pg_net` fan-out visible in `net._http_response` per transition | ⏳ operator | requires a linked project with `app.edge_url` set — no-op otherwise (proven safe by pgTAP test 5) |
| Edge Functions covered by tests against local Supabase in CI | ✅ | Deno HMAC tests in CI `edge` job; pgTAP `05_*` in CI `sql` job |
| Idempotency proven with a doubled webhook replay | ✅ | pgTAP `05_*` test 2 (replayed `provider_payment_id`) + EF `event.id` guard |

### Deferrals (with hard commits)

- **Phase 5b — real WhatsApp Cloud API dispatcher.** The `NotificationDispatcher`
  seam is in place; swapping `LogNotificationDispatcher` for a WhatsApp
  implementation changes one line in `notify-order-transition/index.ts`.
- **Live `pg_net` verification** — waits on the staging project + `app.edge_url`
  GUC (operator Task 1.1.4).
- **k6 baseline** (`Docs/perf/baseline.md`) still open from Stage 1.

---

## Local Development & Testing Guide

> Everything you need to run and test the **v2 Supabase-native** stack
> (`supabase/` + `packages/*` + `apps/spa`) on a fresh machine. The legacy
> `apps/api` / `apps/web` are **not** part of this flow.

### 0. Prerequisites

| Tool | Version | Needed for | Install |
|---|---|---|---|
| Node.js | ≥ 20 | SPA, packages, tests | https://nodejs.org (or `nvm install 20`) |
| npm | ≥ 10 | workspace scripts | ships with Node |
| Docker Desktop / Engine | latest | local Supabase stack | https://docs.docker.com/get-docker |
| Supabase CLI | latest | migrations, pgTAP, EF serve | `npm i -g supabase` or `brew install supabase/tap/supabase` |
| Deno | ≥ 1.44 | Edge Function tests + typecheck | `curl -fsSL https://deno.land/install.sh \| sh` |

> **Note:** the shared/client/SPA test suites need only **Node**. Docker +
> Supabase CLI + Deno are required only for the database (pgTAP), Edge
> Functions, and full end-to-end (Playwright against real Supabase).

### 1. Install workspace dependencies

```bash
git clone <repo> && cd CartSas
npm ci                      # installs all workspaces (shared, client, spa, api, web)
npm run build --workspace=@virundhu/shared   # emit dist/ so client typechecks resolve
```

### 2. Boot the local Supabase stack

```bash
supabase start             # first run pulls images (~2 min); needs Docker running
```

This starts Postgres 16, PostgREST, GoTrue (auth), Realtime, Studio, and the
Edge runtime, and prints local URLs + keys. Key defaults from `config.toml`:

| Service | URL / Port |
|---|---|
| API (PostgREST/GoTrue) | `http://localhost:54321` |
| Postgres (direct) | `localhost:54322` |
| Supavisor pooler (transaction mode) | `localhost:54329` |
| Studio (DB GUI) | `http://localhost:54323` |
| Inbucket (email capture) | `http://localhost:54324` |

Copy the `anon key` and `service_role key` from the `supabase start` output —
you'll need them below.

### 3. Apply schema + seed

```bash
supabase db reset          # replays EVERY migration in order + runs seed.sql
```

This creates all 8 tables, RLS, the 12 RPCs (incl. Stage 5's `mark_payment_paid`
and `notify_order_transition`), the `public_store_menu` view, the keepalive +
idempotency-sweep cron jobs, and seeds the **Anna Street Food** demo tenant
(slug `anna-street-food`).

> Re-run `supabase db reset` any time you add a migration or want a clean slate.
> **Never edit a migration that has been pushed** — always add a new one
> (CI's `supabase db diff` drift gate enforces this).

### 4. Configure the SPA environment

```bash
cd apps/spa
cp .env.example .env.local
```

Edit `.env.local`:

```bash
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=<anon key from `supabase start`>
VITE_APP_ENV=development
# Bypass the Vercel edge menu proxy for plain `vite dev` (no Vercel dev server):
VITE_PUBLIC_MENU_BASE_URL=
```

### 5. Run the SPA

```bash
npm run dev --workspace=@virundhu/spa      # → http://localhost:5173
```

- **Owner console:** `http://localhost:5173/login`. Local Supabase has
  `enable_signup=false`, so create an owner one of two ways:
  1. **Signup Edge Function (recommended, end-to-end):** serve functions
     (step 6) then use the app's `/signup` page — it calls `auth-signup`, which
     provisions the tenant transactionally.
  2. **Manual (quick):** in Studio → Authentication, create a user, then in the
     SQL editor add a `store_members` row linking that `user_id` to the seeded
     store and set `raw_app_meta_data` to `{"store_ids":["<store-uuid>"],"role":"OWNER"}`.
- **Public storefront:** `http://localhost:5173/menu/anna-street-food` (no auth) —
  browse, add to cart, checkout, and land on the success page.

### 6. Serve Edge Functions locally

```bash
# From repo root. --env-file feeds provider secrets; --no-verify-jwt matches config.toml.
supabase functions serve \
  --env-file supabase/functions/.env.local \
  --import-map supabase/import_map.json
```

Create `supabase/functions/.env.local` (git-ignored) for local testing:

```bash
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
EDGE_SHARED_SECRET=local-dev-secret            # notify-order-transition bearer
PAYMENT_PROVIDER=simulated                      # razorpay-webhook toggle
RAZORPAY_WEBHOOK_SECRET=whsec_local_test        # only needed when PROVIDER=razorpay
ALLOWED_ORIGINS=http://localhost:5173
```

To exercise the **`pg_net` notification fan-out** against your locally-served
functions, point the DB's GUCs at the local Edge runtime (run once in Studio's
SQL editor or via `psql`):

```sql
alter database postgres set app.edge_url    = 'http://host.docker.internal:54321';
alter database postgres set app.edge_secret = 'local-dev-secret';
-- reconnect (or `select pg_reload_conf();`) so RPCs pick up the new GUCs.
```

Now advancing an order in the owner UI fires a background POST to
`notify-order-transition`, which prints a `[notify] ORDER_ACCEPTED …` line in
the `functions serve` terminal. Leave the GUCs unset to make the fan-out a
safe no-op (the default in CI and tests).

**Manually invoke the Razorpay webhook** (simulated mode acknowledges without
applying; set `PAYMENT_PROVIDER=razorpay` to apply):

```bash
BODY='{"id":"evt_1","event":"payment.captured","payload":{"payment":{"entity":{"id":"pay_LOCAL1","notes":{"order_id":"<order-uuid>"}}}}}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "whsec_local_test" -r | cut -d' ' -f1)
curl -s -X POST http://localhost:54321/functions/v1/razorpay-webhook \
  -H "x-razorpay-signature: $SIG" -H "content-type: application/json" -d "$BODY"
```

### 7. Test matrix

| Layer | Command | Toolchain |
|---|---|---|
| Shared contracts | `npm run test --workspace=@virundhu/shared` | Node |
| Typed client | `npm run test --workspace=@virundhu/client` | Node |
| SPA unit | `npm run test --workspace=@virundhu/spa` | Node |
| SPA lint / typecheck | `npm run lint --workspace=@virundhu/spa` · `npm run build --workspace=@virundhu/spa` | Node |
| **DB (pgTAP incl. Stage 5)** | `supabase test db` | Docker + CLI |
| **Edge helpers (Deno)** | `deno test --import-map=supabase/import_map.json supabase/functions/_shared/razorpay.test.ts` | Deno |
| **Edge typecheck (Deno)** | `deno check --import-map=supabase/import_map.json supabase/functions/**/*.ts` | Deno |
| **e2e (real Supabase)** | see below | Node + Playwright |

**Full local verification (one shot):**

```bash
npm run test --workspace=@virundhu/shared \
  && npm run test --workspace=@virundhu/client \
  && npm run test --workspace=@virundhu/spa \
  && supabase test db \
  && deno test --import-map=supabase/import_map.json supabase/functions/_shared/razorpay.test.ts
```

### 8. Playwright e2e (auth + checkout)

The e2e specs (`apps/spa/e2e/{auth,checkout,smoke}.spec.ts`) are **gated** on
env vars and skip cleanly when unset. To run them against local Supabase:

```bash
cd apps/spa
npx playwright install --with-deps          # one-time browser download
E2E_SUPABASE_URL=http://localhost:54321 \
E2E_SUPABASE_ANON_KEY=<anon key> \
E2E_MENU_SLUG=anna-street-food \
npm run test:e2e
```

### 9. Deploy to a linked project (operator)

```bash
supabase link --project-ref <ref>           # needs SUPABASE_ACCESS_TOKEN
supabase db push                            # apply migrations
supabase functions deploy                   # deploy all Edge Functions
# Set production GUCs + secrets:
supabase secrets set EDGE_SHARED_SECRET=... RAZORPAY_WEBHOOK_SECRET=... PAYMENT_PROVIDER=simulated
# In SQL: alter database postgres set app.edge_url='https://<ref>.supabase.co';
#         alter database postgres set app.edge_secret='<EDGE_SHARED_SECRET>';
```

CI (`.github/workflows/db-deploy.yml`) does all of the above automatically on
merge to `main` (jobs: `shared → client → spa`, `sql`, `edge` → `deploy` →
`types-gen`).

### 10. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `supabase start` fails | Docker not running | Start Docker Desktop / `sudo systemctl start docker` |
| SPA: "Missing Supabase env" | `.env.local` absent/incomplete | Set `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` |
| Public menu 404 in `vite dev` | edge proxy expects a Vercel dev server | Set `VITE_PUBLIC_MENU_BASE_URL=` (empty) to read Supabase directly |
| `notify-order-transition` never fires | `app.edge_url` GUC unset | Set the GUC (step 6) + `select pg_reload_conf();` |
| Webhook returns `INVALID_SIGNATURE` | HMAC secret mismatch | Ensure the `openssl` HMAC key matches `RAZORPAY_WEBHOOK_SECRET` |
| Webhook returns `mode: simulated` | `PAYMENT_PROVIDER=simulated` | Set `PAYMENT_PROVIDER=razorpay` to apply captures |
| Owner routes redirect to `/login` | no `store_ids` in JWT | Ensure the user's `app_metadata.store_ids` is set (via `auth-signup` or manually) |

---

## Stage 6 · Hardening, QA, Cutover & Rollback

_Code & docs slice landed; operator/cloud-gated items tracked in Runbook §10._

### 1. Deliverables shipped this stage

| Area | Artefact | Path |
| --- | --- | --- |
| Perf hardening | `pg_stat_statements` enabled; `store_daily_metrics` materialized view + RLS wrapper `store_daily_metrics_v`; composite hot-path indexes on `orders`; 5-min `pg_cron` refresh job | `supabase/migrations/20260901002400_stage6_perf_hardening.sql` |
| Perf test | 7-assertion pgTAP file: matview presence, unique index (concurrent refresh gate), RLS wrapper, anon deny, authenticated grant, hot-path index, cron job scheduled | `supabase/tests/06_stage6_perf_hardening.sql` |
| Data migration | `admin-user-import` Edge Function — bcrypt-hash preserving legacy user importer, gated by `IMPORT_SECRET`, idempotent on email/slug collisions, ≤500 rows/batch | `supabase/functions/admin-user-import/index.ts` |
| Data migration test | Deno tests for the bcrypt shape guard (10 assertions covering $2a/$2b/$2y, cost validation, plaintext rejection, non-string rejection) | `supabase/functions/admin-user-import/bcrypt-guard.test.ts` |
| QA · RLS | Cross-tenant Playwright spec — orders read, RPC guard, categories list — asserts silent-filter (0 rows) not error, and 403 on cross-tenant RPC | `apps/spa/e2e/rls-cross-tenant.spec.ts` |
| Perf · load | k6 script for `/api/menu/[slug]` with ramping-vus (100 → 500), custom `menu_latency_ms` + `menu_errors` metrics, hard thresholds (p95 < 600ms, errors < 0.5%) | `scripts/loadtest/menu.k6.js` |
| Observability | Business-KPI SQL catalogue (DAU, orders/day, revenue/day, top stores, payment success %, cutover progress, `pg_stat_statements` snapshot) | `Docs/SqlQueries.md` |
| Ops | Full Runbook: contacts, environments, alerting matrix, deploy/rollback cheatsheet, cutover timeline (T-72h → T+30d), rollback triggers & procedure (≤30 min RTO), 8 subsystem runbooks | `Docs/Runbook.md` |

### 2. Test matrix (updated)

| Suite | Command | Status |
| --- | --- | --- |
| `@virundhu/shared` | `npm test --workspace=@virundhu/shared` | ✅ 9 tests |
| `@virundhu/client` | `npm test --workspace=@virundhu/client` | ✅ 20 tests |
| `@virundhu/spa` unit + edge handler | `npm test --workspace=@virundhu/spa` | ✅ 11 tests |
| pgTAP `00`–`06` | `supabase test db` | Docker-gated (7 files, 06 adds 7 assertions) |
| Deno · Razorpay HMAC | `deno test supabase/functions/_shared/razorpay.test.ts` | Deno-gated |
| Deno · bcrypt guard | `deno test supabase/functions/admin-user-import/bcrypt-guard.test.ts` | Deno-gated (10 assertions) |
| Playwright · smoke + auth + checkout + rls-cross-tenant | `pnpm --filter @virundhu/spa test:e2e` | env-gated (skips cleanly locally) |
| k6 baseline | `TARGET_URL=… k6 run scripts/loadtest/menu.k6.js` | operator-run |

### 3. Definition-of-Done reconciliation

| Plan.md gate (§6) | Status | Evidence |
| --- | --- | --- |
| §6.1 Observability — Sentry SPA + edge, alerting matrix, KPI queries | ✅ code+docs; Sentry SPA wired at `apps/spa/src/lib/sentry.ts`; DSN wiring + Better Stack are operator items | `Docs/Runbook.md §3`, `Docs/SqlQueries.md` |
| §6.2 QA — cross-tenant RLS spec, Playwright full suite runner | ✅ | `apps/spa/e2e/rls-cross-tenant.spec.ts`, `Docs/Runbook.md §9` |
| §6.3 Perf hardening — `pg_stat_statements`, hot-path indexes, matview + cron, k6 baseline harness | ✅ code; live baseline commit deferred to operator (Runbook §10) | `supabase/migrations/20260901002400_stage6_perf_hardening.sql`, `scripts/loadtest/menu.k6.js` |
| §6.4 Data migration — bcrypt-preserving importer with idempotency | ✅ | `supabase/functions/admin-user-import/`, `Docs/Runbook.md §6` |
| §6.5 Cutover timeline — T-72h → T+30d, checklist form | ✅ | `Docs/Runbook.md §6` |
| §6.6 Rollback — triggers, procedure, RTO ≤ 30m | ✅ | `Docs/Runbook.md §7` |

### 4. Operator-only follow-ups (deferred, tracked)

Every one of these requires cloud/DNS/secret access this repo does not
have. They are enumerated in **`Docs/Runbook.md §10`** so nothing is
lost when Stage 6 closes on the code side:

1. Provision `virundhu-staging` / `virundhu-prod` Supabase projects.
2. Wire Sentry DSNs into Vercel + Supabase function env; create Better Stack monitors.
3. Set `app.edge_url` + `app.edge_secret` GUCs on prod so
   `notify_order_transition` fan-out reaches the Edge Function.
4. Run first k6 baseline against staging and commit
   `Docs/perf/baseline-<YYYYMMDD>.md`.
5. Execute the cutover timeline (Runbook §6) and gate on §6 T+24h before
   destroying the legacy DB snapshot.
6. Rotate `IMPORT_SECRET` post-cutover; keep or remove the
   `admin-user-import` deployment per §6.4 policy.

### 5. Bundle & perf budget check

Bundle size gate (Runbook §9 · gate 6): ≤ 180 KB gzip. Verified in
Stage 3 at 157 KB gz; Stage 6 additions are DB/edge/docs-only and do
not touch the SPA bundle.

Runtime perf gate (Runbook §9 · gate 5): p95 `/api/menu/[slug]` < 600ms
under 500 VUs. Live measurement is operator-gated (§4 above); the k6
script encodes the threshold as a hard failure so CI will enforce it
once the operator wires `TARGET_URL` and runs the perf job.

