# Security Model — v2 Supabase Backend

> **Defence-in-depth threat model** for the greenfield Supabase-native backend. All controls listed here are implemented as code (SQL migrations + Edge Functions + CI gates) — nothing is enforced only at the application layer.

---

## 1. Trust Boundaries

```
┌──────────────────┐    HTTPS + JWT     ┌──────────────────┐
│  Browser (Next)  │ ─────────────────▶ │  Supabase Edge   │
│  anon-key only   │                    │  (PostgREST,     │
└──────────────────┘                    │   GoTrue, Realt.)│
                                        └────────┬─────────┘
                                                 │ SQL over
                                                 │ authenticated
                                                 │ role (RLS ON)
                                                 ▼
                                        ┌──────────────────┐
                                        │  PostgreSQL 16   │
                                        │  RLS + policies  │
                                        │  RPCs (SEC DEF)  │
                                        └──────────────────┘
```

**Key principle:** the browser never sees the `service_role` key. It holds only the public `anon` key + a short-lived user JWT. All authority derives from the JWT claims verified by PostgREST.

---

## 2. Identity & Claims

- **Issuer:** Supabase GoTrue (`HS256`).
- **User id:** `auth.uid()` → maps to `public.store_members.user_id`.
- **Multi-tenant claim:** `app_metadata.store_ids: uuid[]` — set by the `auth-signup` Edge Function and any future "invite user to store" flow. Never mutable by the user.
- **Role claim:** `app_metadata.role: 'owner' | 'staff'` — enforced by policies for privileged mutations.
- **Helper functions** (SQL, `stable`):
  - `public.jwt_store_ids()` → `uuid[]`
  - `public.jwt_role()` → `text`
  - `public.has_store(p_store_id uuid)` → `boolean`

---

## 3. Row Level Security

**Every** application table has `ROW LEVEL SECURITY ENABLED` + `FORCE ROW LEVEL SECURITY` (so even table owners obey policies).

| Table | Read Policy | Write Policy |
|---|---|---|
| `stores` | `id = ANY(jwt_store_ids())` | `id = ANY(jwt_store_ids()) AND jwt_role() = 'owner'` |
| `store_members` | `store_id = ANY(jwt_store_ids())` | owner only |
| `categories` | `store_id = ANY(jwt_store_ids())` | `store_id = ANY(jwt_store_ids())` |
| `products` | same | same |
| `orders` | same | insert via RPC only; direct update denied |
| `order_items` | same (via join) | insert via RPC only |
| `printers` | same | same |

**Public menu view** (`public_store_menu`) is granted `SELECT` to the `anon` role and reads from underlying tables with `SECURITY INVOKER` — but the view is defined as `WITH (security_barrier)` and its `WHERE` clause bypasses RLS via the view owner's grants, so **only published (`is_active = true`) products and non-archived stores are exposed**.

---

## 4. Server-Authoritative Mutations (RPCs)

All state changes that require **atomicity, validation, or invariants** run as `SECURITY DEFINER` PL/pgSQL functions owned by a dedicated `virundhu_api` role. Each RPC:

1. **Re-checks tenancy** via `public.has_store(p_store_id)` — never trusts a payload-supplied `store_id`.
2. **Re-computes money** — client-supplied prices are ignored; the RPC re-reads `products.price` under a `FOR SHARE` lock.
3. **Validates state transitions** — `orders_advance_status` consults an SQL transition matrix identical to `packages/shared/src/transitions.ts`.
4. **Emits audit** — every RPC inserts into `audit_log(actor, action, target, payload_hash)`.

RPCs never take `service_role`. They rely on `auth.uid()` and `auth.jwt()` set by PostgREST.

---

## 5. Threat Model (STRIDE-lite)

| Threat | Vector | Control |
|---|---|---|
| **Spoofing** | Forged JWT | GoTrue-signed `HS256`, secret in Supabase vault, rotated via `supabase secrets set` |
| **Tampering** | Client edits price/quantity in POST body | `orders_create` re-reads price from `products` under lock; ignores client price |
| **Tampering** | Client sets `store_id` of another tenant | RLS `USING` + `WITH CHECK` on every table; RPCs re-verify with `has_store()` |
| **Repudiation** | User denies action | `audit_log` table, append-only, timestamped |
| **Information disclosure** | Cross-tenant read via crafted query | RLS + `FORCE ROW LEVEL SECURITY`; `public_store_menu` uses `security_barrier` view |
| **Information disclosure** | Public menu leaks archived products | View predicate `is_active = true AND stores.status = 'ACTIVE'` |
| **Denial of service** | Unbounded query | PostgREST `max-rows: 1000` + `statement_timeout = 5s` on the `authenticated` role |
| **Denial of service** | Recursive Realtime subscription | Realtime channel authorization enforces `store_id` filter |
| **Elevation of privilege** | Direct SQL from browser | Browser has anon-key only; PostgREST role hierarchy: `anon` → `authenticated` → `service_role` (never exposed) |
| **Elevation of privilege** | Malicious extension | `pg_net`, `pg_cron` schemas revoked from `authenticated` and `anon` |
| **Race conditions** | Two concurrent status updates | `orders_advance_status` uses `SELECT ... FOR UPDATE` on the order row |
| **Order-number collision** | Two orders same second | `next_order_number()` uses per-store advisory lock + daily sequence table |
| **Credential leak in logs** | Password in error message | Supabase logs redact `password`; Edge Functions use `Deno.env` never `console.log(env)` |

---

## 6. Secrets Management

| Secret | Storage | Rotation |
|---|---|---|
| `SUPABASE_DB_PASSWORD` | Supabase project dashboard | Quarterly, breaking-glass procedure documented |
| `SUPABASE_JWT_SECRET` | Supabase vault | Auto-managed by Supabase |
| `service_role` key | GitHub Actions secret (deploy only) | Rotated on team change |
| `anon` key | Public — safe to commit | Never rotated (public by design) |
| Edge Function env vars | `supabase secrets set` | Per-release |

**Never committed:** `.env.local`, `service_role`, DB password. `.gitignore` enforces.

---

## 7. Network Controls

- **CORS:** PostgREST configured to accept origins from `NEXT_PUBLIC_APP_URL` only.
- **Rate limiting:** GoTrue built-in login throttle (5 attempts/min/IP). Edge Functions use `Deno.serve` + in-memory sliding-window limiter (30 req/min/IP) for `auth-signup`.
- **TLS:** Enforced by Supabase; no HTTP fallback.

---

## 8. CI/CD Gates

Every PR must pass:

1. `supabase db lint` — pgTAP static checks (no missing RLS, no missing `SECURITY DEFINER` search_path).
2. `pgtap` unit tests — one test per policy, verifying cross-tenant denial.
3. `deno lint && deno test` — Edge Functions.
4. `npm run typecheck` — shared Zod contracts.
5. Migration replay — apply all migrations against a fresh Postgres 16 container, seed, then run `supabase db diff` and require **zero drift**.

A merge without these green checks is blocked by branch protection.

---

## 9. Incident Response Hooks

- **Kill switch:** setting `stores.status = 'SUSPENDED'` immediately blocks all reads/writes via RLS predicate.
- **Global kill switch:** revoking the `authenticated` role's grants disables the entire API in one SQL statement.
- **Point-in-time recovery:** Supabase PITR enabled — 7-day window on Pro plan.

---

## 10. Open Items (tracked in DevDoc_V2)

- [ ] MFA for owner accounts (Stage 5)
- [ ] Signed URLs for future receipt PDFs (Stage 4)
- [ ] pgAudit extension evaluation for finer-grained logging (Stage 5)
