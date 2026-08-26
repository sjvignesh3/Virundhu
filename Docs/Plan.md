# Virundhu — Porting Plan: NestJS + Next.js → React (Vite) + TypeScript + Supabase

> **Status:** Proposal · v2.0 · August 2026 (revised to incorporate architecture review feedback)
> **Owner:** Engineering
> **Scope:** Full port of Virundhu (multi-tenant food-ordering SaaS) from the current **NestJS (Render) + Next.js (Vercel) + Supabase Postgres** stack onto a **React SPA (Vite) + Supabase (Postgres + Auth + RLS + Edge Functions + Realtime + Storage)** stack.
> **Approach:** Greenfield rewrite. Reuse only the domain contracts (`@virundhu/shared`: Zod schemas, enums, state-machine transitions, totals) and the Postgres data model. No incremental strangler refactor.
> **Guiding principles:** Performance (P95 API < 250 ms in Chennai), Reliability (99.9% during business hours), Security (defence-in-depth via RLS + JWT + Edge auth), Cost ($0/month at 10–20 tenants, ≤ $75/month at 300 tenants), Maintainability (< 1 developer to run day-to-day).

---

## What changed in v2.0

Four architecture-review recommendations were folded in and are now first-class throughout the plan:

1. **Router: TanStack Router** replaces React Router 6. End-to-end typed params, native TanStack Query integration, no runtime route-param bugs across `/order/$slug`, `/owner/orders/$id`.
2. **Complex workflows in typed Edge Functions.** PL/pgSQL RPCs are reserved for **atomic ACID writes** (order create, state transition, sequence allocation). Multi-step orchestrations (payment verify → notify → webhook) live in **Supabase Edge Functions (Deno + TypeScript)** so they can `import` from `@virundhu/shared` and reuse the same state-machine code the client uses.
3. **`pg_cron` for keepalive** — replaces external Vercel Cron. Runs inside Postgres, one less moving part, no HTTP round-trip.
4. **CDN Stale-While-Revalidate for public menu** — a dedicated menu RPC returns pre-shaped JSON, served with `Cache-Control: public, max-age=60, s-maxage=300, stale-while-revalidate=86400`. 99% of customer visits hit the edge cache in < 50 ms with zero database load.

The plan is now organized into **six implementation stages** (previously ten phases). Each stage is a shippable increment with its own DoD, tests, and rollback story.

---

## Table of Contents

- [Part I — Foundations](#part-i--foundations)
  - [0. Executive Summary](#0-executive-summary)
  - [1. Target Architecture](#1-target-architecture)
  - [2. Technology Stack Decisions](#2-technology-stack-decisions)
  - [3. Repository & Module Layout](#3-repository--module-layout)
  - [4. Cross-Cutting Foundations](#4-cross-cutting-foundations)
- [Part II — Implementation Stages](#part-ii--implementation-stages)
  - [Stage 1 · Foundation & Backend Bring-Up](#stage-1--foundation--backend-bring-up)
  - [Stage 2 · Identity, Tenancy & Typed Data Layer](#stage-2--identity-tenancy--typed-data-layer)
  - [Stage 3 · SPA Shell, Owner Console & Realtime](#stage-3--spa-shell-owner-console--realtime)
  - [Stage 4 · Customer Ordering & Edge-Cached Menu](#stage-4--customer-ordering--edge-cached-menu)
  - [Stage 5 · Edge-Function Orchestrations & Notifications](#stage-5--edge-function-orchestrations--notifications)
  - [Stage 6 · Hardening, QA, Cutover & Rollback](#stage-6--hardening-qa-cutover--rollback)
- [Part III — Reference Playbooks](#part-iii--reference-playbooks)
  - [Security Playbook](#security-playbook)
  - [Performance Playbook](#performance-playbook)
  - [Cost Model](#cost-model)
  - [Risk Register](#risk-register)
  - [Definition of Done (universal)](#definition-of-done-universal)
- [Part IV — Appendices](#part-iv--appendices)
  - [A. Timeline (calendar view)](#a-timeline-calendar-view)
  - [B. What NOT to build (yet)](#b-what-not-to-build-yet)
  - [C. Scaling roadmap (post-launch)](#c-scaling-roadmap-post-launch)

---

# Part I — Foundations

## 0. Executive Summary

### Why rewrite?

- **Render's cold starts** (30–50 s on free tier) break live order-taking. Removing NestJS-on-Render removes the single largest reliability defect.
- **Two runtimes → one runtime.** Consolidating on Supabase eliminates the NestJS API layer entirely. Business logic is split cleanly:
  - **PL/pgSQL RPCs** for atomic transactional writes (co-located with data, single round-trip).
  - **Edge Functions (TypeScript/Deno)** for multi-step orchestrations that need `@virundhu/shared` imports (payments, notifications, webhooks, signup).
  - **React client** for UI state only.
- **Native RLS** replaces application-layer `StoreMembershipGuard`, closing an entire class of cross-tenant bugs by construction.
- **Cost floor of $0/month** for validation (1–20 tenants), predictable at ~$25/month for growth (100 tenants), ~$75/month at scale (300 tenants).
- **Vite SPA vs Next.js App Router:** current usage is 100% authenticated dashboards + public menus that don't benefit from SSR. Static SPA + CDN cache beats SSR on cost, complexity, and (with SWR) latency.

### What we keep

- The Postgres data model (12 tables) — proven, well-indexed, Supabase-compatible.
- `@virundhu/shared` → renamed `@virundhu/shared`: Zod schemas, enums, `transitions.ts` state machine, totals calculators. **Single source of truth**, imported by React client **and** by Deno Edge Functions.
- Product decisions: FC-XXXX order numbers, soft-delete strategy, state machine, `Decimal(10,2)` money.

### What we discard

- **NestJS** (`apps/api/*` entirely) — replaced by PostgREST + RPCs + Edge Functions.
- **Prisma** — replaced by generated Supabase TypeScript types + `@supabase/supabase-js`. Migrations are plain SQL managed via Supabase CLI.
- **Next.js** (App Router, RSC, middleware) — replaced by a Vite React SPA. Public-menu SEO handled via a small optional prerender step (deferred).
- **React Router 6** — replaced by **TanStack Router** for type-safe params.

### Verdict

Rewrite over refactor because ~60% of the NestJS codebase is boilerplate that RLS + RPCs replace natively. The 40% that is real domain logic (order creation, totals, state machine) is small, well-tested, and split into:
- **~30% PL/pgSQL RPCs** — the atomic-write kernel.
- **~10% Deno Edge Functions** — orchestrations that need TS `import` from `@virundhu/shared`.

---

## 1. Target Architecture

```
                                    ┌──────────────────────────────────────────┐
                                    │              Users (Tamil Nadu)          │
                                    │  Owner tablets · Customer phones (QR)    │
                                    └────────────┬────────────────┬────────────┘
                                                 │                │
                                                 ▼                ▼
                                    ┌───────────────────────────────────────┐
                                    │   Vercel Edge CDN                     │
                                    │   · Static React SPA (Vite build)     │
                                    │   · SWR-cached /menu/:slug proxy      │
                                    │     (max-age=60, s-max=300, SWR=86400)│
                                    └────────────┬──────────────────────────┘
                                                 │  HTTPS (JWT for auth routes)
                                                 ▼
                     ┌──────────────────────────────────────────────────────────┐
                     │                    Supabase (Mumbai, ap-south-1)         │
                     │                                                          │
                     │  ┌────────────┐  ┌────────────┐  ┌───────────────────┐   │
                     │  │  Auth       │  │ PostgREST  │  │  Realtime (WS)    │   │
                     │  │  (GoTrue)   │  │ auto-CRUD  │  │  owner order feed │   │
                     │  │  JWT + JWKS │  │  + RPCs    │  │                   │   │
                     │  └──────┬─────┘  └──────┬─────┘  └────────┬──────────┘   │
                     │         │               │                 │              │
                     │         ▼               ▼                 ▼              │
                     │  ┌────────────────────────────────────────────────────┐  │
                     │  │  PostgreSQL 16  ·  Row Level Security (per tenant) │  │
                     │  │  · Tables · Views · RPCs (SECURITY DEFINER)        │  │
                     │  │  · Triggers (audit, sequence, updated_at)          │  │
                     │  │  · pg_cron (keepalive, nightly rollup)             │  │
                     │  │  · Indexes on every (store_id, *) tuple            │  │
                     │  └────────────────────────────────────────────────────┘  │
                     │                                                          │
                     │  ┌──────────────────────────────────┐  ┌──────────────┐  │
                     │  │  Edge Functions (Deno + TS)      │  │  Storage     │  │
                     │  │  · signup-owner                  │  │  bucket:     │  │
                     │  │  · razorpay-webhook              │  │  store-media │  │
                     │  │  · notify-order-transition       │  │  transforms: │  │
                     │  │  · admin-user-import (cutover)   │  │  webp/300    │  │
                     │  │  → all import @virundhu/shared   │  │              │  │
                     │  └──────────────────────────────────┘  └──────────────┘  │
                     └──────────────────────────────────────────────────────────┘
```

### Request paths

| Interaction | Path | Runtime |
|---|---|---|
| Owner login | React → Supabase Auth `signInWithPassword` → JWT with `store_ids` in `app_metadata` | GoTrue |
| Owner list orders | React → PostgREST `/rest/v1/orders?...` (RLS filters by JWT) | PostgREST |
| Owner accept order | React → `rpc/transition_order(order_id, to_status)` | PL/pgSQL (atomic) |
| Owner live board | React → Realtime channel `orders:store_id=eq.<uuid>` | Realtime WS |
| Owner signup | React → Edge Function `signup-owner` → `auth.admin.createUser` + `rpc/bootstrap_store` | Deno + TS |
| Customer view menu | Vercel Edge SWR cache → PostgREST view `public_store_menu?slug=eq.<slug>` | Cached → PostgREST |
| Customer place order | React → `rpc/create_public_order(cart_json)` | PL/pgSQL (atomic) |
| Payment webhook (Razorpay, later) | Razorpay → Edge Function `razorpay-webhook` → `rpc/mark_payment_paid` → Edge Function `notify-order-transition` | Deno + TS |
| Order transition side-effects | `rpc/transition_order` → `pg_net.http_post` → Edge Function `notify-order-transition` | PL/pgSQL → Deno |
| Keepalive | `pg_cron` `SELECT 1;` every 24 h | Native Postgres |

**Boundary rule:**

> If the operation is a **single ACID write** or a **read aggregation**, it is a **PL/pgSQL RPC**.
> If it involves **more than one external system**, **complex TS types**, or **@virundhu/shared imports**, it is an **Edge Function**.
> RPCs stay short (< 100 lines); anything else escalates to an Edge Function.

---

## 2. Technology Stack Decisions

| Concern | Choice | Rejected alternatives | Rationale |
|---|---|---|---|
| Bundler | **Vite 5** | Next.js, CRA, Parcel | 4× faster dev server; no SSR/RSC overhead for auth-gated app |
| Framework | **React 18 + TypeScript 5.5** | SolidJS, Svelte | Team fluency, largest ecosystem |
| **Router** | **TanStack Router 1.x** | React Router 6, wouter | End-to-end typed params (`/order/$slug`, `/owner/orders/$id`); native TanStack Query integration; loader/beforeLoad model; no runtime param bugs |
| Server state | **TanStack Query 5** | SWR, Redux RTK Query | Best-in-class cache invalidation + suspense; pairs natively with TanStack Router |
| Client state | **Zustand** | Redux, Jotai | Already used; tiny (~1 kB); no boilerplate |
| Forms | **React Hook Form + Zod resolver** | Formik | Preserves `@virundhu/shared` schemas |
| Styling | **Tailwind CSS + shadcn/ui + Radix** | CSS Modules, Chakra | Already used; unchanged |
| Backend platform | **Supabase (Postgres + Auth + Realtime + Edge Functions + Storage)** | Firebase, AWS Amplify, self-hosted Nest | Single-vendor, native Postgres, Mumbai region, generous free tier |
| DB access | **`@supabase/supabase-js` v2** + `supabase gen types` | Prisma, Kysely, Drizzle | No ORM; RLS + typed RPCs cover safety |
| Atomic writes | **PL/pgSQL functions (RPC, `SECURITY DEFINER`)** | Node code with multi-query transactions | Single round-trip, ACID, close to indexes |
| Multi-step workflows | **Supabase Edge Functions (Deno + TypeScript)** | AWS Lambda, Vercel Serverless | Co-located with DB; can `import` from `@virundhu/shared`; TS state machines reused verbatim |
| Migrations | **Supabase CLI plain SQL** | Prisma Migrate | No ORM; SQL is the truth |
| Cron | **`pg_cron`** (native Postgres scheduler) | Vercel Cron, GitHub Actions | Zero external dependency; no HTTP round-trip |
| Public-menu caching | **Vercel Edge SWR** proxy route → PostgREST view | Direct client → PostgREST | Cache hit < 50 ms; DB reads collapse to 1 per 60 s per slug |
| Payments (Stage 5) | **Razorpay** via Edge Function webhook | Stripe (KYC harder in India) | India-first, UPI-native |
| Notifications (Stage 5) | **Edge Function `notify-order-transition`** (stub → WhatsApp Cloud API) | Direct DB trigger to third party | Testable, retryable, secret-safe |
| Monitoring | **Sentry (frontend)** + **Supabase logs** + **Better Stack Uptime (free)** | Datadog, New Relic | Zero-cost baseline |
| CI/CD | **GitHub Actions** — lint, typecheck, vitest, pgTAP, `supabase db push --dry-run` | GitLab CI, CircleCI | Free at this scale |
| Testing | **Vitest** (unit) + **Playwright** (e2e) + **pgTAP** (SQL/RLS/RPCs) | Jest, Cypress | Playwright covers realtime; pgTAP is the only serious SQL-side option |
| Package manager | **pnpm 9** | npm, Yarn | 2× faster; strict `node_modules` |

---

## 3. Repository & Module Layout

```
virundhu/                            (renamed from CartSas at cutover — DNS unchanged)
├── apps/
│   └── web/                         React SPA (Vite)
│       ├── index.html
│       ├── public/                  favicon, robots, PWA icons
│       ├── src/
│       │   ├── main.tsx
│       │   ├── router.tsx           TanStack Router root + route tree
│       │   ├── routes/              file-based route tree (TanStack Router)
│       │   │   ├── __root.tsx
│       │   │   ├── index.tsx        landing
│       │   │   ├── login.tsx
│       │   │   ├── signup.tsx
│       │   │   ├── order.$slug.tsx  customer menu
│       │   │   ├── order.$slug.success.$orderNumber.tsx
│       │   │   └── _owner/          authenticated shell + nested pages
│       │   │       ├── _owner.tsx           layout + beforeLoad(requireAuth)
│       │   │       ├── dashboard.tsx
│       │   │       ├── orders.live.tsx
│       │   │       ├── orders.history.tsx
│       │   │       ├── orders.$id.tsx       typed :id
│       │   │       ├── products.tsx
│       │   │       ├── categories.tsx
│       │   │       ├── reports.tsx
│       │   │       ├── qr.tsx
│       │   │       ├── printers.tsx
│       │   │       └── settings.tsx
│       │   ├── features/            self-contained feature modules
│       │   │   ├── auth/
│       │   │   ├── categories/
│       │   │   ├── products/
│       │   │   ├── orders/
│       │   │   ├── dashboard/
│       │   │   ├── reports/
│       │   │   ├── printers/
│       │   │   ├── settings/
│       │   │   ├── qr/
│       │   │   └── customer-order/
│       │   ├── components/          shared UI (button, card, dialog, …)
│       │   └── lib/
│       │       ├── supabase/        client factory, typed helpers
│       │       ├── queries/         TanStack Query key + fn definitions
│       │       ├── realtime/        channel manager, useRealtimeSubscribe
│       │       ├── auth/            session store, guards, JWT decode
│       │       └── utils/
│       ├── vite.config.ts
│       ├── tsconfig.json
│       ├── .env.example             VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
│       └── vercel.json              SPA rewrite + /menu/:slug SWR proxy
│
├── supabase/                        Backend as code
│   ├── config.toml                  Supabase CLI project config
│   ├── migrations/                  timestamped SQL migrations
│   │   ├── 20260901000000_extensions.sql          (pg_cron, pg_net, pgcrypto)
│   │   ├── 20260901000100_enums.sql
│   │   ├── 20260901000200_tables_core.sql
│   │   ├── 20260901000300_tables_menu.sql
│   │   ├── 20260901000400_tables_orders.sql
│   │   ├── 20260901000500_tables_payments.sql
│   │   ├── 20260901000600_tables_printers.sql
│   │   ├── 20260901000700_tables_settings.sql
│   │   ├── 20260901000800_indexes.sql
│   │   ├── 20260901000900_triggers_updated_at.sql
│   │   ├── 20260901001000_rls_policies.sql
│   │   ├── 20260901001100_rpc_bootstrap_store.sql
│   │   ├── 20260901001200_rpc_create_public_order.sql
│   │   ├── 20260901001300_rpc_transition_order.sql
│   │   ├── 20260901001400_rpc_mark_payment_paid.sql
│   │   ├── 20260901001500_rpc_dashboard_metrics.sql
│   │   ├── 20260901001600_views_public_menu.sql
│   │   └── 20260901001700_cron_keepalive.sql
│   ├── functions/                   Edge Functions (Deno + TS)
│   │   ├── _shared/                 imported by every function
│   │   │   ├── supabase-admin.ts    service-role client factory
│   │   │   ├── shared.ts            re-exports @virundhu/shared
│   │   │   └── errors.ts            HTTP error envelope
│   │   ├── signup-owner/
│   │   │   └── index.ts
│   │   ├── razorpay-webhook/
│   │   │   └── index.ts
│   │   ├── notify-order-transition/
│   │   │   └── index.ts
│   │   └── admin-user-import/       one-shot cutover tool
│   │       └── index.ts
│   ├── seed.sql                     dev-only demo data (Anna Street Food)
│   └── tests/                       pgTAP tests
│       ├── rls.test.sql
│       ├── rpc_create_order.test.sql
│       ├── rpc_transition_order.test.sql
│       └── rpc_dashboard_metrics.test.sql
│
├── packages/
│   └── shared/                      @virundhu/shared (dual-published: node + deno)
│       ├── src/
│       │   ├── enums.ts
│       │   ├── schemas.ts           Zod
│       │   ├── transitions.ts       state machine (client + Edge)
│       │   ├── totals.ts
│       │   ├── api-errors.ts
│       │   └── db-types.ts          re-export of `supabase gen types`
│       ├── deno.json                Deno import map (for Edge Functions)
│       └── package.json             Node workspace entry
│
├── .github/
│   └── workflows/
│       ├── ci.yml                   lint + typecheck + vitest + pgtap
│       ├── db-deploy.yml            supabase db push on main
│       ├── functions-deploy.yml     supabase functions deploy on main
│       └── web-deploy.yml           Vercel deploy hook
│
├── Docs/
│   ├── Plan.md                      ← this file
│   ├── DevDoc.md                    living memory
│   ├── Runbook.md                   incident playbook (Stage 6)
│   ├── SecurityModel.md             RLS matrix + threat model (Stage 1)
│   ├── ApiInventory.md              legacy → new endpoint map (Stage 1)
│   └── Deployment.md                Supabase + Vercel walkthrough (Stage 6)
│
├── package.json                     pnpm workspace root
├── pnpm-workspace.yaml
├── .gitignore
└── README.md
```

**Rename rationale:** internal package prefix moves from `@cartsas/*` to `@virundhu/*` at cutover, matching the user-facing brand. Historical `localStorage` keys retain `cartsas:v*` prefixes for backward compatibility during migration.

**Dual publishing of `@virundhu/shared`:** the package ships both a Node/ESM entry (for the React app) and a Deno-compatible entry (via `deno.json` import map) so Edge Functions can `import { canTransition, orderCreateSchema } from '../_shared/shared.ts'` and get the exact same code the client runs.

---

## 4. Cross-Cutting Foundations

Applied to every stage — every PR is reviewed against these.

### 4.1 Security

- **All tenant tables carry `store_id`** (exceptions: `auth.users`, `stores`, `store_users`, `profiles`).
- **RLS enabled on every table**; default policy is `USING (false)` — access granted explicitly.
- **JWT claim `app_metadata.store_ids: uuid[]`** attached at signup. Policies read `auth.jwt() -> 'app_metadata' -> 'store_ids'` — zero DB reads per request for tenancy checks.
- **RPCs are `SECURITY DEFINER`** so they can bypass RLS for transactional writes, but **always** revalidate tenancy as the first statement.
- **Anon key** is bundled into React and used only for the public menu and public order placement.
- **Service-role key** never leaves Edge Functions.
- **Zod on the client, revalidated in Edge Functions and RPCs** — the client is untrusted; the server re-runs schema checks.

### 4.2 Performance targets

| Metric | Target | Measurement |
|---|---|---|
| Cold page load (owner dashboard, 3G) | < 3.0 s LCP | Lighthouse mobile |
| Warm interaction (Accept order) | < 300 ms round-trip | Sentry performance |
| Realtime latency (new order → owner sees it) | < 1500 ms P95 | Playwright e2e timer |
| **Public menu load (cache HIT)** | **< 100 ms TTFB** | Chrome DevTools / Sentry |
| Public menu load (cache MISS) | < 500 ms TTFB | RUM |
| DB egress per owner per active hour | < 2 MB | Supabase dashboard |
| Bundle size (owner shell) | < 250 kB gzipped | vite-bundle-visualizer |

### 4.3 Reliability

- **No cold starts on the hot path** — Vercel static + Supabase = warm always. Edge Functions have ~50 ms cold start (acceptable for webhooks and signup).
- **`pg_cron` keepalive** hits DB every 24 h to defeat 7-day pause; runs inside Postgres, no external triggers.
- **Retry with backoff** on all mutations (TanStack Query `retry: 2, retryDelay: exponential`).
- **Offline fallback** for customer menu (service worker caches last successful menu view; cart in `sessionStorage`).
- **Backups**: manual `pg_dump` weekly to Cloudflare R2 (free tier 10 GB) via GitHub Action; Supabase daily backup once on Pro tier.

### 4.4 Cost discipline

- Every new feature states its impact on **egress GB/mo**, **Realtime concurrent connections**, and **Edge Function invocations**.
- **Realtime restricted to authenticated owner Live Orders route only** — customers use HTTP + polling on success page. Protects the 200-connection free-tier ceiling.
- **Edge Functions kept to specialized low-frequency workloads** — webhooks, signup, notifications. Standard CRUD stays on PostgREST/RPCs to preserve the 500 k invocations/mo budget.
- Images stored in Supabase Storage with server-side transforms → webp @ 300 px.

### 4.5 Maintainability

- One-page runbook per subsystem (`Docs/Runbook.md`).
- Every SQL migration includes a `-- ROLLBACK:` comment block.
- Every RPC has a pgTAP test.
- Every Edge Function has a Vitest/Deno test running against local Supabase.
- Weekly dependency audit (`pnpm audit --prod`) in CI.

---

# Part II — Implementation Stages

Each stage is a **shippable increment** — the app is testable at the end of each stage. Stages run mostly sequentially, with parallel tracks marked ⟂.

| Stage | Name | Effort | Blocks next | Ships to |
|---|---|---|---|---|
| 1 | Foundation & Backend Bring-Up | 5 days | Yes | Staging (backend only) |
| 2 | Identity, Tenancy & Typed Data Layer | 4 days | Yes | Staging (backend + types) |
| 3 | SPA Shell, Owner Console & Realtime | 8 days | No | Staging (feature-complete owner) |
| 4 | Customer Ordering & Edge-Cached Menu | 4 days | No | Staging (feature-complete public) |
| 5 | Edge-Function Orchestrations & Notifications | 4 days | No | Staging (Razorpay + WhatsApp stubs) |
| 6 | Hardening, QA, Cutover & Rollback | 5 days | Final | **Production** |

**Total:** ~30 dev-days across ~6.5 calendar weeks with one full-stack dev + one part-time reviewer.

---

## Stage 1 · Foundation & Backend Bring-Up

**Duration:** 5 days · **Owner:** Backend + Tech lead · **Blocking:** Yes

Establishes the backend that everything else builds on: schema, RLS, RPCs, cron, seed, CI gates. **Zero client code in this stage.**

### 1.1 Discovery & preflight (Day 1)

| # | Task | Deliverable |
|---|---|---|
| 1.1.1 | Inventory current NestJS endpoints (`apps/api/src/modules/**`) — request/response shapes, called-by | `Docs/ApiInventory.md` — 1 row per endpoint |
| 1.1.2 | Map each endpoint → PostgREST GET / RPC / Edge Function | Additional column in inventory |
| 1.1.3 | Publish `@virundhu/shared@1.0.0` — rename only, no shape changes | pnpm workspace package + `deno.json` for Edge Function consumption |
| 1.1.4 | Create Supabase projects `virundhu-staging` and `virundhu-prod` (both Mumbai `ap-south-1`) | Connection strings stored in 1Password |
| 1.1.5 | Local Supabase CLI up (`supabase init`, `supabase start`) | Docker containers healthy on `localhost:54321` |
| 1.1.6 | Baseline load test on **current** system (k6, 20 concurrent, 5-min soak, top 5 endpoints) | `Docs/perf/baseline.md` |
| 1.1.7 | Threat model (STRIDE across new architecture) | `Docs/SecurityModel.md` v0 |

### 1.2 Schema migrations (Day 2)

One migration per logical unit — small, reviewable, revertible:

```
supabase/migrations/
  20260901000000_extensions.sql          -- pg_cron, pg_net, pgcrypto, uuid-ossp
  20260901000100_enums.sql               -- order_status, payment_status, etc.
  20260901000200_tables_core.sql         -- profiles (FK auth.users), stores, store_users
  20260901000300_tables_menu.sql         -- categories, products
  20260901000400_tables_orders.sql       -- orders, order_items, order_status_history, order_sequences
  20260901000500_tables_payments.sql     -- payments
  20260901000600_tables_printers.sql     -- printers
  20260901000700_tables_settings.sql     -- store_settings
  20260901000800_indexes.sql             -- every (store_id, *) tuple + composite hot paths
  20260901000900_triggers_updated_at.sql -- auto-touch updated_at
```

**Key differences from current Prisma schema:**

1. **No custom `users` table.** Use `auth.users` and hold profile fields in `public.profiles` linked 1:1 via `id uuid references auth.users(id)`. No `passwordHash` — Auth owns credentials.
2. **Timestamps:** `timestamptz` everywhere (Prisma defaulted to `timestamp`). Store UTC.
3. **`snake_case`** column names — align with PostgREST convention. `@virundhu/shared/db-types.ts` handles the mapping.
4. **Order sequence** — keep `order_sequences` table; access with `FOR UPDATE` inside `create_public_order` RPC.

### 1.3 Row Level Security (Day 3 AM)

`20260901001000_rls_policies.sql` — every tenant-owned table gets:

```sql
alter table public.orders enable row level security;

-- Owner reads: JWT must contain the store_id in app_metadata.store_ids
create policy "orders_owner_select"
  on public.orders for select
  to authenticated
  using (
    store_id = any (
      coalesce(
        (auth.jwt() -> 'app_metadata' -> 'store_ids')::jsonb,
        '[]'::jsonb
      )::text[]::uuid[]
    )
  );

-- No direct insert/update/delete policies for owners:
-- all owner writes go through SECURITY DEFINER RPCs.
-- Customer inserts go through create_public_order (also SECURITY DEFINER).
```

Full RLS matrix in `Docs/SecurityModel.md`: **12 tables × 4 operations × 3 roles (anon / authenticated / service_role) = 144 cells**, each with policy status. Every policy has a pgTAP test asserting the positive AND negative cases.

### 1.4 RPC catalog (Day 3 PM + Day 4)

**Atomic writes only** — kept short (< 100 lines each). Multi-step orchestrations move to Stage 5 Edge Functions.

| RPC | Args | Returns | Purpose |
|---|---|---|---|
| `bootstrap_store(user_id, store_name, store_slug)` | uuid, text, text | jsonb | Called by `signup-owner` Edge Function only. Inserts profile + store + store_user + settings + order_sequence in one transaction. |
| `create_public_order(store_slug, items jsonb, customer jsonb, notes)` | text, jsonb, jsonb, text | jsonb | Public. Loads products `FOR UPDATE`, revalidates availability/stock/minimum, computes totals server-side, upserts customer by phone, increments sequence, inserts payment (`SIMULATED PAID`), returns order + FC number. |
| `transition_order(order_id, to_status, note)` | uuid, text, text | orders row | Owner. Validates transition against ported state-machine SQL, updates status, inserts history row, sets `completed_at`/`cancelled_at`. Emits `pg_net.http_post` to `notify-order-transition` Edge Function (Stage 5). |
| `soft_delete_product(product_id)` | uuid | product row | Owner. If product has orders → `is_available=false`; else delete. |
| `soft_delete_category(category_id)` | uuid | category row | Owner. Blocks if products remain (raises `CATEGORY_HAS_PRODUCTS`). |
| `mark_payment_paid(order_id, provider_payment_id, provider)` | uuid, text, text | orders row | Called by `razorpay-webhook` only. Idempotent by `provider_payment_id`. |
| `dashboard_metrics(store_id, from_ts, to_ts)` | uuid, tsz, tsz | jsonb | Owner. Aggregates counts + revenue + top items in one query using covering indexes. |
| `report_summary(store_id, from_ts, to_ts)` | uuid, tsz, tsz | jsonb | Owner. Same shape as dashboard, larger date window. |
| `keepalive_ping()` | — | int | Called by `pg_cron` job. Returns 1. |

**Every RPC starts with:**

```sql
-- Revalidate tenancy from JWT claims (works even though SECURITY DEFINER)
if not (
  p_store_id = any (
    coalesce(
      (auth.jwt() -> 'app_metadata' -> 'store_ids')::jsonb,
      '[]'::jsonb
    )::text[]::uuid[]
  )
) then
  raise exception 'FORBIDDEN' using errcode = '42501';
end if;
```

Errors are raised via `raise exception '<CODE>'` and caught client-side, mapped to the `api-errors` enum matching today's contract (`STORE_CLOSED`, `PRODUCT_OUT_OF_STOCK`, `INVALID_TRANSITION`, etc.).

### 1.5 Public menu view (Day 4 PM)

`20260901001600_views_public_menu.sql`:

```sql
create view public.public_store_menu as
select
  s.slug,
  jsonb_build_object(
    'store',      to_jsonb(s.*) - 'created_at' - 'updated_at',
    'settings',   to_jsonb(ss.*) - 'store_id',
    'categories', coalesce(
                    (select jsonb_agg(to_jsonb(c.*) order by c.display_order)
                     from categories c
                     where c.store_id = s.id and c.is_active),
                    '[]'::jsonb
                  ),
    'products',   coalesce(
                    (select jsonb_agg(
                       jsonb_build_object(
                         'id', p.id, 'name', p.name, 'tamil_name', p.tamil_name,
                         'price', p.price, 'image_url', p.image_url,
                         'category_id', p.category_id, 'is_available', p.is_available
                       )
                       order by p.display_order
                     )
                     from products p
                     where p.store_id = s.id and p.is_available),
                    '[]'::jsonb
                  )
  ) as menu_json
from stores s
left join store_settings ss on ss.store_id = s.id
where s.status = 'OPEN';
```

Single row per slug → single JSON payload → single edge cache entry.

### 1.6 pg_cron keepalive (Day 5 AM)

`20260901001700_cron_keepalive.sql`:

```sql
select cron.schedule(
  'virundhu_keepalive',
  '0 0 * * *',                            -- daily at 00:00 UTC
  $$ select public.keepalive_ping(); $$
);
```

**Zero external dependency.** Runs inside Postgres. Verified by querying `cron.job_run_details`.

For notification/side-effect fan-out from RPCs to Edge Functions (Stage 5), we use `pg_net.http_post` — also native, no cron needed since it's request-triggered.

### 1.7 Seed & CI gates (Day 5 PM)

- `supabase/seed.sql` — Anna Street Food demo (matches current seed). Applied automatically on `supabase db reset` (local only). Never runs on prod.
- `.github/workflows/db-deploy.yml`:
  1. On PR: `supabase db diff --linked` → comment on PR.
  2. On PR: `supabase test db` → pgTAP suite green.
  3. On merge to `main`: `supabase db push` → staging first, then prod after manual approval.

### Stage 1 DoD

- [ ] 12 tables migrated with RLS enabled.
- [ ] 9 RPCs shipped with pgTAP tests (positive + negative).
- [ ] `public_store_menu` view live and returning valid JSON for the seed store.
- [ ] `pg_cron` keepalive job scheduled and visible in `cron.job`.
- [ ] pgTAP suite green in CI.
- [ ] Staging Supabase project queryable via `curl` from a laptop.
- [ ] `Docs/SecurityModel.md` updated with RLS matrix.

---

## Stage 2 · Identity, Tenancy & Typed Data Layer

**Duration:** 4 days · **Owner:** Backend + Frontend ⟂ · **Blocking:** Yes

Solves identity end-to-end and delivers the typed client-side data layer that all UI code will consume.

### 2.1 Signup Edge Function (Day 1)

Because anonymous clients cannot set `app_metadata.store_ids` (only service role can), signup goes through an Edge Function:

```typescript
// supabase/functions/signup-owner/index.ts
import { signupSchema, apiErrors } from "../_shared/shared.ts";
import { supabaseAdmin } from "../_shared/supabase-admin.ts";

Deno.serve(async (req) => {
  const body = await req.json();
  const parsed = signupSchema.safeParse(body);   // reuses @virundhu/shared
  if (!parsed.success) return jsonError(400, "VALIDATION_ERROR", parsed.error);

  const { email, password, name, storeName, storeSlug } = parsed.data;

  // 1. Preflight uniqueness (fast-fail — RPC re-checks)
  // 2. Create Auth user
  const { data: user, error: uErr } = await supabaseAdmin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (uErr) return jsonError(409, "EMAIL_ALREADY_USED", uErr);

  try {
    // 3. Bootstrap store (single atomic RPC)
    const { data: store, error: bErr } = await supabaseAdmin.rpc("bootstrap_store", {
      p_user_id: user.user!.id, p_store_name: storeName, p_store_slug: storeSlug, p_display_name: name,
    });
    if (bErr) throw bErr;

    // 4. Attach store_id to JWT claims
    await supabaseAdmin.auth.admin.updateUserById(user.user!.id, {
      app_metadata: { store_ids: [store.id] },
    });

    // 5. Return session so client can sign in transparently
    const { data: session } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink", email,
    });
    return jsonOk({ store_id: store.id, session });
  } catch (err) {
    // Rollback: delete orphaned Auth user
    await supabaseAdmin.auth.admin.deleteUser(user.user!.id);
    return jsonError(409, err.message, err);
  }
});
```

**Client-side:** on success the React app calls `supabase.auth.signInWithPassword` to establish the session (JWT already carries `store_ids`).

### 2.2 Login & session (Day 1 PM)

- Plain `supabase.auth.signInWithPassword` on the client.
- Supabase JS persists tokens in `localStorage` (built-in).
- `onAuthStateChange` listener in `lib/auth/session-store.ts` mirrors session to Zustand (sign-out anywhere → all tabs redirect).
- **AuthGuard** = TanStack Router `beforeLoad` on the `_owner` layout route that reads session; unauthenticated → `throw redirect({ to: '/login' })`.

### 2.3 Generated types (Day 2 AM)

```
pnpm dlx supabase gen types typescript --project-id <ref> --schema public \
  > packages/shared/src/db-types.ts
```

Runs in CI on every DB migration merge; committed to the repo so the client build is deterministic.

### 2.4 Repository pattern (Day 2 PM + Day 3)

Keep the current abstraction — insulates UI from Supabase specifics and preserves the local-mode demo for QA:

```
apps/web/src/features/orders/data/
  orders.repo.ts          ← concrete Supabase implementation
  orders.queries.ts       ← TanStack Query hooks (useOrders, useTransitionOrder)
  orders.types.ts         ← re-exports from @virundhu/shared
  orders.repo.test.ts     ← Vitest against local Supabase
```

Every feature owns its own `data/` folder — no cross-feature imports of repos.

### 2.5 Query keys & mutation invalidation (Day 3 PM)

```ts
export const orderKeys = {
  all:                          ['orders'] as const,
  list:   (storeId, filter)  => [...orderKeys.all, 'list', storeId, filter] as const,
  detail: (id)                => [...orderKeys.all, 'detail', id] as const,
  active: (storeId)           => [...orderKeys.all, 'active', storeId] as const,
};
```

Every mutation returns the updated row and calls both:
- `queryClient.setQueryData` (optimistic patch)
- `queryClient.invalidateQueries({ queryKey: orderKeys.all })` (safety net)

### 2.6 Column projection discipline (Day 4)

**Never** `.select('*')` in a query. Every query lists columns explicitly to control egress. Enforced by an ESLint custom rule + grep-in-CI:

```ts
export const ORDER_LIST_COLUMNS =
  'id, order_number, status, total_amount, created_at, ' +
  'customer:customers(name, phone), items_count:order_items(count)';
```

### Stage 2 DoD

- [ ] New user can sign up via Edge Function, land on `/owner/dashboard` with a working session, and place a query that returns their (empty) store data.
- [ ] Cross-tenant read returns `[]` — never an error (matches PostgREST + RLS behaviour).
- [ ] `db-types.ts` generated and imported by at least one feature.
- [ ] Repo pattern established for `orders`, `products`, `categories`.
- [ ] Lint rule blocks `.select('*')` in `src/features/**`.
- [ ] Playwright e2e: signup happy path + duplicate email + duplicate slug.
- [ ] pgTAP: RLS negative tests green (User A cannot see User B's data).

---

## Stage 3 · SPA Shell, Owner Console & Realtime

**Duration:** 8 days · **Owner:** Frontend · **Blocking:** No

Builds the Vite SPA scaffolding and rewrites every owner page against the new data layer. Ships behind a feature flag for incremental UAT.

### 3.1 Vite + TanStack Router shell (Day 1)

- Vite 5 + React SWC plugin.
- Path alias `@/` → `src/`.
- Bundle analyzer plugin gated behind `ANALYZE=1`.
- Manual chunks: `react`, `supabase`, `radix`, `tanstack`.
- `build.target: 'es2020'` (safe for all Chennai devices in scope).
- **TanStack Router** with file-based routing under `src/routes/`.
- Route-level `beforeLoad` for auth guard; route-level `loader` for TanStack Query prefetch.

Example typed route:

```tsx
// src/routes/_owner/orders.$id.tsx
export const Route = createFileRoute('/_owner/orders/$id')({
  beforeLoad: requireAuth,
  loader: ({ params, context: { queryClient } }) =>
    queryClient.ensureQueryData(orderKeys.detail(params.id)),
  component: OrderDetailPage,
});
// Inside the page: `Route.useParams().id` is typed as string — compile-time safety.
```

### 3.2 PWA & error boundaries (Day 1 PM)

- `vite-plugin-pwa` scoped to the customer menu route only (offline-first).
- Owner console is deliberately online-only — writes must always be authoritative.
- Manifest with Tamil name (`விருந்து`), icons, theme color.
- Route-level `errorComponent` renders friendly failure state.
- Top-level `ErrorBoundary` reports to Sentry.

### 3.3 Feature parity rewrite (Days 2–6)

Ordered so each subsequent feature depends on the previous being green:

| Order | Feature | Data source | Realtime? | Notes |
|---|---|---|---|---|
| 1 | Dashboard | `rpc/dashboard_metrics` | No (5-min TTL) | Single RPC → full payload |
| 2 | Products list & form | PostgREST select + insert/update | No | Client-side search (< 500 rows) |
| 3 | Categories | PostgREST + `rpc/soft_delete_category` | No | — |
| 4 | Live orders | PostgREST + Realtime channel | **Yes** | See §3.4 |
| 5 | Order detail sheet | PostgREST select + `rpc/transition_order` | No | Actions call RPC |
| 6 | Order history | PostgREST paginated (`.range(0,19)`) | No | 20/page, cursor pagination |
| 7 | Reports | `rpc/report_summary` | No | CSV export client-side from RPC payload |
| 8 | QR poster | Client-only (`qrcode` lib) | No | No backend call |
| 9 | Printers | PostgREST CRUD | No | Config only |
| 10 | Settings | PostgREST update `store_settings` | No | Optimistic UI |

### 3.4 Realtime — Live Orders board (Day 7)

Replaces the current 5-second polling. **Only the Live Orders route opens a channel** — this is the single largest cost lever on the free tier.

```ts
useEffect(() => {
  const channel = supabase
    .channel(`orders:${storeId}`)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'orders', filter: `store_id=eq.${storeId}` },
      () => queryClient.invalidateQueries({ queryKey: orderKeys.active(storeId) })
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}, [storeId]);
```

**Guardrails:**
- One channel per store, not per component.
- Coalesced invalidations (debounce 250 ms) to survive bursts.
- `visibilitychange` handler closes the channel when tab hidden > 60 s.
- Fallback: if the channel status is `CHANNEL_ERROR` twice, drop silently to 10-second polling.

### 3.5 Feature-level testing (Day 8)

- Vitest unit tests for repo + component per feature.
- Playwright e2e for each primary happy path.
- Manual mobile pass on a real Android device.

### Stage 3 DoD

- [ ] Every route reachable from the owner sidebar renders real data.
- [ ] All mutation flows have success + error toasts.
- [ ] Live board updates within 1 s of a new order.
- [ ] Zero `console.error` in production build.
- [ ] Lighthouse mobile ≥ 90 on owner dashboard.
- [ ] Bundle < 250 kB gzipped for the owner shell.

---

## Stage 4 · Customer Ordering & Edge-Cached Menu

**Duration:** 4 days · **Owner:** Frontend + Backend ⟂ · **Blocking:** No

Rebuilds `/order/$slug` — the highest-traffic route — with sub-second LCP on 4G phones via CDN caching.

### 4.1 Edge-cached menu route (Day 1)

Add a Vercel Edge route `apps/web/api/menu/[slug].ts` (or `vercel.json` rewrite) that proxies to Supabase:

```ts
// apps/web/api/menu/[slug].ts (Vercel Edge Runtime)
export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const slug = url.pathname.split('/').pop();

  const upstream = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/public_store_menu?slug=eq.${slug}&select=menu_json`,
    { headers: { apikey: process.env.SUPABASE_ANON_KEY!, Accept: 'application/vnd.pgrst.object+json' } },
  );

  if (!upstream.ok) return new Response('Not found', { status: 404 });

  return new Response(await upstream.text(), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      // 99% of Chennai visitors hit the edge in < 50 ms with zero DB load.
      'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400',
      'CDN-Cache-Control': 'max-age=300',
    },
  });
}
```

**Cache math (300 orders/day per store, 1000 store visitors):**
- Without SWR: 1000 DB reads/day/store → 300 000 reads/day for 300 stores.
- With SWR (5-min s-maxage): ≤ 288 reads/day/store → 86 400 reads/day for 300 stores. **~3.5× reduction in DB egress.**

Cache invalidation on menu update: the owner's product/category mutations call a lightweight `POST /api/menu/[slug]/revalidate` route that uses Vercel's on-demand revalidation API to purge the cache entry. Falls back to natural TTL expiry.

### 4.2 Public data path RLS (Day 1 PM)

RLS on public tables (already defined in Stage 1, verified here):
- `stores` — anon SELECT of `slug, name, tamil_name, description, phone, address, logo_url, image_url, status` where `status='OPEN'`.
- `categories` — anon SELECT filtered to `is_active=true`.
- `products` — anon SELECT filtered to `is_available=true`.
- `public_store_menu` view inherits RLS from these tables.

### 4.3 Menu, cart, checkout UI (Days 2–3)

- SPA render. Chennai users hit Vercel edge in Mumbai/Singapore (~30 ms). LCP hero via `<img loading="eager">` from Supabase Storage image transform (`?width=800&format=origin`).
- Skeleton renders in < 100 ms from the cached HTML shell (workbox precache).
- `<link rel="preconnect" href="https://<project>.supabase.co">` in `index.html` cuts DNS + TLS handshake to ~50 ms.
- Cart in `sessionStorage` per slug (matches current key `cartsas:v1:cart:<slug>`).
- Optimistic add-to-cart with sticky footer bar.
- "Pay Now" → `rpc/create_public_order` → success page.

### 4.4 Success page (Day 4)

- Public order lookup by `order_number + store_slug` (RLS allows anon SELECT filtered to these two columns).
- No polling — customer sees the initial confirmation and can refresh manually.
- QR code with order number for easy re-lookup.

### Stage 4 DoD

- [ ] Menu loads in < 500 ms cache-MISS, < 100 ms cache-HIT (Chennai 4G).
- [ ] Order placement round-trip < 800 ms.
- [ ] Success page cross-device viewable.
- [ ] Edge cache hit rate > 90% after warm-up (verified in Vercel Analytics).
- [ ] Menu cache invalidates within 30 s of an owner-side product update.

---

## Stage 5 · Edge-Function Orchestrations & Notifications

**Duration:** 4 days · **Owner:** Backend · **Blocking:** No

Adds the TypeScript-side workflows: Razorpay webhook, notification dispatch, `pg_net` fan-out from RPCs. All Edge Functions `import` from `@virundhu/shared` so state machines and schemas are reused verbatim.

### 5.1 Notification dispatcher (Day 1)

`packages/shared/src/notifications.ts` — provider-agnostic interface:

```ts
export interface NotificationDispatcher {
  send(kind: NotificationKind, payload: NotificationPayload): Promise<void>;
}
export type NotificationKind = 'ORDER_ACCEPTED' | 'ORDER_READY' | 'ORDER_COMPLETED' | 'ORDER_CANCELLED';
```

`supabase/functions/notify-order-transition/index.ts` — Deno + TS:

```ts
import { canTransition, NotificationKind } from '../_shared/shared.ts';

Deno.serve(async (req) => {
  const { order_id, from_status, to_status } = await req.json();
  if (!canTransition(from_status, to_status)) {           // reused from @virundhu/shared
    return new Response('Invalid transition', { status: 400 });
  }
  // Phase 5a: log-only stub
  console.log('notify', { order_id, from_status, to_status });
  // Phase 5b: WhatsApp Cloud API dispatch
  return new Response('ok');
});
```

### 5.2 pg_net fan-out from RPC (Day 2)

`rpc/transition_order` gains a trailing `pg_net.http_post` call:

```sql
perform net.http_post(
  url     := current_setting('app.edge_url', true) || '/functions/v1/notify-order-transition',
  headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'Authorization', 'Bearer ' || current_setting('app.edge_secret', true)
             ),
  body    := jsonb_build_object('order_id', v_order.id, 'from_status', v_from, 'to_status', p_to)
);
```

`app.edge_url` and `app.edge_secret` are set via `alter database ... set ...` — never in application code.

**Why not a database trigger?** Triggers are synchronous and can slow user-facing writes if the target is slow. `pg_net.http_post` is asynchronous — the RPC returns immediately, the notification fires in the background.

### 5.3 Razorpay webhook (Day 3)

`supabase/functions/razorpay-webhook/index.ts`:

```ts
import { verifyRazorpaySignature } from '../_shared/razorpay.ts';
import { supabaseAdmin } from '../_shared/supabase-admin.ts';

Deno.serve(async (req) => {
  const body = await req.text();
  const sig = req.headers.get('x-razorpay-signature')!;
  if (!verifyRazorpaySignature(body, sig, Deno.env.get('RAZORPAY_WEBHOOK_SECRET')!)) {
    return new Response('Invalid signature', { status: 401 });
  }
  const event = JSON.parse(body);
  if (event.event === 'payment.captured') {
    await supabaseAdmin.rpc('mark_payment_paid', {
      p_order_id: event.payload.payment.entity.notes.order_id,
      p_provider_payment_id: event.payload.payment.entity.id,
      p_provider: 'razorpay',
    });
  }
  return new Response('ok');
});
```

Ships behind `PAYMENT_PROVIDER=simulated|razorpay` toggle in Edge Function secrets. Default remains `simulated` until Stage 5+.

### 5.4 Rate limiting & idempotency (Day 4)

- Every Edge Function checks a small `idempotency_keys` table (or `provider_payment_id` for Razorpay) before doing work.
- Rate-limit `signup-owner` at 3 attempts/hour/IP via a `signup_attempts` table + trigger. Cloudflare WAF layered on later.

### Stage 5 DoD

- [ ] `notify-order-transition` logs correctly for every transition triggered in the owner UI.
- [ ] `razorpay-webhook` accepts a signed test event and updates the order (staging).
- [ ] `pg_net` fan-out visible in `net._http_response` for every `transition_order` call.
- [ ] All Edge Functions covered by Vitest/Deno tests running against local Supabase in CI.
- [ ] Idempotency proven with a doubled webhook replay test.

---

## Stage 6 · Hardening, QA, Cutover & Rollback

**Duration:** 5 days · **Owner:** Full team · **Blocking:** Final gate

### 6.1 Observability (Day 1)

| Signal | Tool | What we track |
|---|---|---|
| Frontend errors | Sentry (free tier: 5k errors/mo) | JS exceptions, unhandled rejections |
| Frontend perf | Sentry performance | LCP, FID, INP, TTFB per route |
| Backend errors | Supabase Logs Explorer | RPC failures, RLS denials, Edge Function panics |
| DB metrics | Supabase Dashboard | Connections, CPU, storage growth |
| Uptime | Better Stack (free, 10 monitors) | Ping web + `/functions/v1/signup-owner` (HEAD) + edge menu route |
| Cache hit rate | Vercel Analytics | `/menu/:slug` hit ratio |
| Business KPIs | Supabase SQL Editor scheduled queries | DAUs, orders/day, revenue/day |

Alerting:
- Sentry: > 10 errors in 5 min → email.
- Better Stack: 2 consecutive failed pings → email + WhatsApp.
- Supabase: > 80% DB storage → email (built-in).

### 6.2 QA gates (Day 2)

All must pass before cutover:

- [ ] Full Playwright suite green (owner happy path + customer happy path + auth negatives + cross-tenant RLS negatives).
- [ ] pgTAP suite green.
- [ ] Deno test suite for all Edge Functions green.
- [ ] Vitest suite green (≥ 90% coverage in `features/*/data/`).
- [ ] Lighthouse mobile ≥ 90 on `/order/:slug`, ≥ 85 on `/owner/dashboard`.
- [ ] k6 load test: 100 concurrent users × 5 min, P95 < 500 ms on all RPCs.
- [ ] Edge menu route: 200 rps × 60 s, cache hit rate > 95%, P95 < 100 ms.
- [ ] Manual UAT walk-through of the cutover checklist (§6.4).

### 6.3 Performance hardening (Day 3)

- Add indexes discovered during load test.
- Materialize `store_today_metrics` if computed query > 100 ms (materialized view refreshed via `pg_cron` every minute).
- `pg_stat_statements` on; identify top-5 heaviest queries; optimize.
- Verify `Cache-Control` headers on `/menu/:slug` route in production.

### 6.4 Data migration (Day 4)

Two Supabase projects run in parallel from Stage 4:
- **Old prod**: `virundhu-legacy` (current Prisma-owned schema).
- **New prod**: `virundhu-prod` (Supabase-native).

Both are Postgres; the schema shapes are near-identical (`snake_case` rename is the main delta). Migration script:

```bash
# Dry run against staging
pg_dump --data-only --column-inserts \
  --exclude-table=_prisma_migrations \
  "$LEGACY_URL" > migrate.sql

# Rename identifiers (once, verified in staging)
sed -i 's/"passwordHash"/"password_hash"/g; s/"orderNumber"/"order_number"/g; ...' migrate.sql

psql "$NEW_URL" < migrate.sql
```

**Auth users** — passwords bcrypt-hashed by NestJS cannot be *directly* imported into Supabase Auth. Solution: **`admin-user-import` Edge Function** that reads legacy users and calls `supabase.auth.admin.createUser` with the `password_hash` field (Supabase supports bcrypt hash import). **Zero user friction — existing owners keep their passwords.**

Fallback (Option B): email everyone a password-reset link at cutover. Retained as a rollback if bcrypt import fails on ≥ 5% of accounts.

### 6.5 Cutover runbook (Day 5 AM)

```
T-24 h  Freeze legacy prod (banner: "read-only maintenance in 24h").
T-2 h   Dry-run migration on staging with prod dump.
T-0     1. Enable maintenance page on legacy (Vercel rewrite → static "back soon").
        2. Take final pg_dump of legacy.
        3. Restore into new prod (data only).
        4. Run admin-user-import Edge Function.
        5. Update DNS: virundhu.in → new Vercel deployment.
        6. Warm caches: curl against top 20 store slugs (populates /menu/:slug).
        7. Announce complete.
T+30 m  Spot-check: 5 known owners log in and place a test order.
T+24 h  Decommission legacy Render service.
T+30 d  Delete legacy Supabase project (final snapshot to cold storage first).
```

### 6.6 Rollback plan (Day 5 PM)

If any of the following at T+0 → T+30 min:
- Sentry error rate > 5 × baseline
- Failed logins > 20% of attempts
- Order placement P95 > 3 s

Then:
1. Flip DNS back to legacy Vercel + Render.
2. Writes from the cutover window (< 30 min) captured from new DB via `pg_dump` and replayed into legacy manually.
3. Post-mortem within 24 h; fix and reschedule.

### Stage 6 DoD

- [ ] All observability dashboards live.
- [ ] All QA gates green.
- [ ] Cutover complete. Zero data loss. All owners reachable.
- [ ] Legacy Render service turned off.
- [ ] Rollback rehearsed at T-24 h.

---

# Part III — Reference Playbooks

## Security Playbook

Living document at `Docs/SecurityModel.md`. Highlights:

- **Threat model:** STRIDE per data path (customer order, owner login, webhook).
- **RLS matrix:** 12 tables × 4 ops × 3 roles = 144 cells, each with policy status.
- **Secrets:**
  - `VITE_SUPABASE_ANON_KEY` — public, bundled into JS.
  - `SUPABASE_SERVICE_ROLE_KEY` — Edge Function secret only, rotated quarterly.
  - `RAZORPAY_WEBHOOK_SECRET` — Edge Function secret.
  - `app.edge_url`, `app.edge_secret` — Postgres `alter database ... set ...`.
  - No secret in git — enforced via `gitleaks` in CI.
- **Auth:**
  - Password policy 8+ chars, letter + number (matches current Zod).
  - Email confirmation off in Stages 1–4 (invite-only onboarding); on in Stage 5+ for self-serve growth.
  - Session length: 1 h access token, 7-day refresh.
  - Signup rate limit: 3 attempts/hour/IP.
- **Input validation:** Zod on client → Zod re-check inside Edge Functions → PL/pgSQL structural + business-rule checks in RPCs.
- **Transport:** HTTPS everywhere, HSTS via Vercel default.
- **OWASP Top 10:** SQL injection blocked by parameterized queries + RLS; XSS by React auto-escape; SSRF-none (Edge Functions egress restricted to Razorpay + Meta); CSRF-none (JWT in `Authorization` header, no cookies).
- **Audit trail:** `order_status_history` extended with a generic `audit_log` for security events (login, password change, member added).

## Performance Playbook

### Frontend
- Code-split every route (TanStack Router built-in).
- Prefetch primary next route on hover/focus (owner sidebar).
- Product images ≤ 60 kB webp via Supabase image transforms.
- Preload hero fonts (currently system-ui — zero cost).
- Turn off React Strict Mode double-render in prod.

### Database
- Every FK indexed.
- Composite `(store_id, status, created_at desc)` on `orders`.
- `EXPLAIN ANALYZE` review of top 10 queries during Stage 6.
- `pg_stat_statements` on; weekly cron dumps top offenders.

### Network
- HTTP/2 (Vercel default).
- Preconnect to Supabase in `index.html`.
- Aggressive `Cache-Control: public, max-age=31536000, immutable` on static assets.
- Public menu SWR-cached at Vercel edge (60 s max-age, 300 s s-maxage, 86 400 s SWR).

### Realtime discipline
- One channel per store, not per component.
- Unsubscribe on route unmount.
- Debounced invalidations (250 ms).
- Only Live Orders route opens a channel.

## Cost Model

| Stage | Owners | Orders/mo | Egress | Vercel | Supabase | Sentry | Uptime | **Total** |
|---|---|---|---|---|---|---|---|---|
| Prototype | 1 | 100 | < 100 MB | Free | Free | Free | Free | **$0** |
| Validation | 20 | 2 000 | < 500 MB | Free | Free | Free | Free | **$0** |
| Growth | 100 | 10 000 | ~2 GB | Free* | Pro $25 | Free | Free | **$25** |
| Scale | 300 | 30 000 | ~4 GB | Pro $20 | Pro $25 | Team $26 | Paid $10 | **~$81** |

*Vercel Hobby is technically non-commercial. At 100 owners we upgrade to Pro for compliance ($20/mo) OR migrate the static build to Cloudflare Pages (free, no commercial restriction). Cloudflare migration is a documented ~2 h task if we want to stay under $50/mo at scale.

## Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Supabase 7-day free-tier pause during quiet week | Med | High | `pg_cron` keepalive; upgrade to Pro at 50 tenants |
| R2 | RLS policy bug → cross-tenant read | Low | Critical | pgTAP negative tests per table; peer review on all policy PRs |
| R3 | Auth bcrypt import fails at cutover | Low | Medium | Rehearse on staging; fallback = password-reset email |
| R4 | Vercel Hobby commercial-use enforcement email | Low | Low | Pre-approved migration to Cloudflare Pages (2 h) |
| R5 | Realtime concurrent-connection ceiling (200 free) | Med | Med | Restrict to owner Live Orders; polling fallback wired |
| R6 | Egress overrun (5 GB free) via oversized product images | Med | Low | Storage image transforms + client compression; weekly monitor |
| R7 | Rewrite scope creep | High | High | Feature-freeze during port; only bug-parity accepted |
| R8 | PL/pgSQL RPC becomes unmaintainable | Med | Med | RPCs ≤ 100 lines; larger workflows → Edge Function |
| R9 | TanStack Router file-routing convention learning curve | Med | Low | Stage 3 Day 1 spike; pairing on the first three routes |
| R10 | Team PL/pgSQL + RLS knowledge gap | High | Med | Stage 1 spike; every RPC PR requires DB SME review |
| R11 | Edge Function cold start on infrequent webhooks | Low | Low | Warm invocations from Better Stack ping every 15 min |
| R12 | pg_net delivery failures silently drop notifications | Med | Med | Weekly audit of `net._http_response` for non-2xx; retry loop in `notify-order-transition` |

## Definition of Done (universal)

Every stage merges to `main` only when its own DoD is satisfied **and** all of these are green:

- [ ] All new SQL migrations have a `-- ROLLBACK:` block.
- [ ] All new RPCs have pgTAP tests (positive + negative).
- [ ] All new Edge Functions have Deno tests.
- [ ] All new React components have at least one Vitest render test.
- [ ] `pnpm typecheck` clean.
- [ ] `pnpm test` green.
- [ ] `pnpm build` produces a bundle ≤ target size.
- [ ] `Docs/DevDoc.md` updated in the same PR.
- [ ] `Docs/Plan.md` updated with any deviations (never let the plan lie).

---

# Part IV — Appendices

## A. Timeline (calendar view)

Assumes 1 full-stack dev + 1 part-time reviewer, 5 working days/week.

```
Week 1   [Stage 1 — Foundation & Backend]                    5d
Week 2   [Stage 2 — Identity, Data Layer]                    4d
         [Stage 3 — SPA Shell Day 1] ⟂                       1d
Week 3   [Stage 3 — Owner Console]                           5d
Week 4   [Stage 3 continues + Realtime]                      3d
         [Stage 4 — Customer Ordering start] ⟂               2d
Week 5   [Stage 4 completes]                                 2d
         [Stage 5 — Edge Function Orchestrations]            3d
Week 6   [Stage 5 finish + Stage 6 — Hardening & QA]         5d
Week 7   [Stage 6 — Cutover + buffer]                        2–4d
```

**Total elapsed:** 6.5–7 weeks.
**Total effort:** ~30 dev-days.

## B. What NOT to build (yet)

To ship on the timeline above, these features are explicitly deferred:

- ❌ Razorpay **live** payments (webhook exists — provider toggled in Stage 5, live-enabled in a post-launch PR)
- ❌ WhatsApp notifications **live delivery** (dispatcher exists — Meta Cloud API creds wired post-launch)
- ❌ Multi-store owner UI (schema ready, UI post-launch)
- ❌ Customer accounts (guest-only until post-launch)
- ❌ Loyalty / discount codes
- ❌ Inventory forecasting
- ❌ Owner mobile app (PWA-first)
- ❌ Multi-language beyond Tamil + English
- ❌ Analytics platform beyond Supabase SQL editor

Ship the core. Iterate on real data.

## C. Scaling roadmap (post-launch)

Milestones triggered by real usage, not calendar dates.

| Trigger | Action | Cost impact |
|---|---|---|
| 30-day active owners ≥ 50 | Upgrade Supabase → Pro ($25/mo): daily backups, PITR, no pause | +$25/mo |
| Vercel bandwidth > 80 GB/mo | Upgrade Vercel → Pro ($20/mo) **or** move static build to Cloudflare Pages | +$0–$20/mo |
| DB CPU sustained > 60% | Enable Supabase Compute add-on (Medium: 2 vCPU, 4 GB RAM) | +$30/mo |
| Egress > 4 GB/mo | Move product images to Cloudflare R2 (10 GB free egress) + Image Transforms | ~$0 |
| Realtime connections > 150 concurrent | Restrict Realtime to `store.status='OPEN'` hours; poll otherwise | $0 |
| Multiple owners per store | Enable store-switcher UI (schema already supports) | $0 |
| Razorpay live | Flip `PAYMENT_PROVIDER=razorpay` in Edge Function secrets | ~₹2/txn |
| WhatsApp Cloud API live | Wire template approvals; flip feature flag | ~₹0.50/msg |
| Karnataka expansion | No infra change — Mumbai ≤ 60 ms to Bangalore | $0 |
| 1000+ tenants | Consider dedicated Postgres compute + read replicas | +$100/mo |

---

*End of Plan.md · v2.0 · August 2026*
