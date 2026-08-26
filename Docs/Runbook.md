# Virundhu Ops Runbook

_Stage 6 · Hardening, QA, Cutover & Rollback deliverable._

This is the single source of truth for on-call. Every incident-class
scenario below has a **detection**, **diagnosis**, and **mitigation**
section, plus a link to the code that owns the invariant.

**Do not paraphrase this document in Slack — link to the section.**

---

## 1. Contacts & Ownership

| Role                | Primary            | Backup             |
| ------------------- | ------------------ | ------------------ |
| DB / RLS            | Backend lead       | Platform           |
| Edge Functions      | Backend lead       | Backend lead       |
| SPA / Vercel        | Frontend lead      | Backend lead       |
| Payments (Razorpay) | Finance ops        | Backend lead       |
| WhatsApp / Twilio   | Platform           | Frontend lead      |

Escalation path: on-call → primary owner → engineering manager → CTO.

---

## 2. Environments & URLs

| Env      | SPA                              | Supabase project                  | Cutover state         |
| -------- | -------------------------------- | --------------------------------- | --------------------- |
| dev      | `http://localhost:4173`          | `virundhu-local` (Docker)         | n/a                   |
| staging  | `staging.virundhu.com`           | `virundhu-staging`                | active                |
| prod     | `app.virundhu.com`               | `virundhu-prod`                   | **cutover pending**   |

The legacy `apps/api` (NestJS on Render) is still serving prod until the
cutover in §7 completes.

---

## 3. Alerting Matrix

Sentry projects: `virundhu-spa`, `virundhu-edge`.
Uptime: Better Stack HTTP monitors on the routes below.
DB: Supabase project alerts (built-in) forward to `#virundhu-alerts`.

| Signal                                         | Where                    | Severity | Threshold           | Runbook §  |
| ---------------------------------------------- | ------------------------ | -------- | ------------------- | ---------- |
| SPA JS error rate                              | Sentry `virundhu-spa`    | P2       | > 1% sessions / 10m | §8.1       |
| Edge Function 5xx                              | Sentry `virundhu-edge`   | P1       | > 5 / 5m            | §8.2       |
| `razorpay-webhook` 4xx (signature failure)     | Sentry `virundhu-edge`   | P1       | > 3 / 15m           | §8.4       |
| `pg_stat_activity` long-running query          | Supabase alert           | P2       | > 30s               | §8.5       |
| Postgres CPU                                   | Supabase alert           | P1       | > 80% for 5m        | §8.5       |
| Auth signups                                   | Supabase alert           | P3       | drops to 0 for 24h  | §8.1       |
| `/menu/[slug]` uptime                          | Better Stack             | P1       | 2 consecutive fails | §8.3       |
| `pg_cron` keepalive last-run                   | manual (`cron.job_run_details`) | P2 | > 12h ago      | §8.6       |
| Materialized-view staleness                    | manual                   | P3       | > 30m               | §8.5       |

---

## 4. Deploy & Rollback Cheatsheet

### 4.1 Deploy DB migrations

```bash
# Preview locally
supabase db push --dry-run

# Apply against staging
supabase link --project-ref $STAGING_REF
supabase db push
supabase test db --file supabase/tests/*.sql   # pgTAP suite

# Promote to prod (only after staging is green ≥ 24h)
supabase link --project-ref $PROD_REF
supabase db push
```

### 4.2 Deploy Edge Functions

```bash
supabase functions deploy auth-signup
supabase functions deploy notify-order-transition
supabase functions deploy razorpay-webhook
supabase functions deploy admin-user-import --no-verify-jwt
```

### 4.3 Deploy SPA (Vercel)

`main` → auto-deploy to staging. Promote via Vercel UI or:

```bash
vercel promote --scope virundhu <deployment-url>
```

### 4.4 Rollback (order of operations)

1. **SPA**: `vercel rollback <last-good>` — instant, no data risk.
2. **Edge Functions**: `supabase functions deploy <name>` from the last-good
   git SHA. Downgrade is a redeploy, not a version switch.
3. **DB migrations**: **never** attempt to revert with `db pull` in prod.
   Instead, write a compensating forward migration. Every migration is
   authored to be forward-only; a rollback migration is a code review.
   Exception: the Stage 6 perf-hardening migration (§6.3) only adds
   indexes, views, and cron jobs — safe to drop manually if it causes
   contention (see §8.5).

---

## 5. Runbook Index

- §6  Cutover timeline (T-24h → T+30d)
- §7  Rollback triggers & procedures
- §8  Subsystem runbooks
  - §8.1 Auth & signup
  - §8.2 Orders (create / advance)
  - §8.3 Public menu & checkout
  - §8.4 Payments (Razorpay)
  - §8.5 Database (RLS, perf, materialized views)
  - §8.6 Scheduled jobs (`pg_cron`)
  - §8.7 Notifications (WhatsApp / email fan-out)
  - §8.8 Realtime channels
- §9  QA gates (must be green before each stage promotion)
- §10 Operator-only Stage 6 follow-ups (deferred)

---

## 6. Cutover Timeline

_This is a rehearsed sequence. Do NOT skip a step; every step has an abort
gate in §7._

### T-72h · Freeze

- [ ] Announce read-only window in `#customers` and via in-app banner.
- [ ] Freeze legacy NestJS `apps/api` deploy pipeline (require manual
      approval on Render for any push to `main`).
- [ ] Snapshot legacy Prisma DB → S3 (`legacy-final-YYYYMMDD.sql.gz`).

### T-24h · Dry-run on staging

- [ ] Run `admin-user-import` against a **copy** of the legacy DB pointed
      at `virundhu-staging`. Verify row counts match: users, stores,
      categories, products.
- [ ] Run full pgTAP suite: `supabase test db`.
- [ ] Run `npm run test` at repo root — all Node suites (`shared`,
      `client`, `spa`) must be green.
- [ ] Run k6 baseline: `TARGET_URL=https://staging.virundhu.com/api/menu/anna-street-food k6 run scripts/loadtest/menu.k6.js`.
- [ ] Attach the k6 summary to `Docs/perf/baseline-YYYYMMDD.md`.
- [ ] Playwright staging suite: `VIRUNDHU_SPA_URL=https://staging.virundhu.com pnpm --filter @virundhu/spa test:e2e` — includes `rls-cross-tenant.spec.ts` with the two-tenant fixtures.
- [ ] Sentry release marker created for staging.

### T-2h · Prod pre-flight

- [ ] Re-snapshot legacy DB (final).
- [ ] Verify all env vars set on prod project:
      `SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_KEY_SECRET`,
      `RAZORPAY_WEBHOOK_SECRET`, `IMPORT_SECRET`, `WHATSAPP_TOKEN`,
      `WHATSAPP_PHONE_ID`, `app.edge_url`, `app.edge_secret`.
- [ ] `supabase db push` to prod.
- [ ] `supabase functions deploy` all four functions to prod.
- [ ] Wire DNS: `app.virundhu.com` CNAME → Vercel prod deployment
      (keep TTL at 60s until T+24h).

### T-0 · Cutover

- [ ] Set legacy NestJS API to return HTTP 503 for all `/api/*` routes.
- [ ] Run `scripts/import-legacy-users.ts` in batches of 500 against the
      `admin-user-import` Edge Function.
- [ ] Sanity: `select count(*) from auth.users` matches legacy user count.
- [ ] Flip DNS TTL to 60s → wait 2 min → point to Vercel.
- [ ] Smoke: sign-in as three real owners (canary list in vault).
- [ ] Post-cutover banner: "You may need to sign in again."

### T+2h · Steady-state watch

- [ ] Sentry error rate < 1%, no new issue clusters.
- [ ] `orders` insert rate matches historical baseline (±30%).
- [ ] Razorpay dashboard shows successful captures matching
      `orders.payment_status = 'PAID'` count.

### T+24h · Gate

- [ ] All P1/P2 alerts silent for 24h consecutive.
- [ ] Decision: **commit** (destroy legacy DB snapshot retention policy →
      90 days) **or** **rollback** (§7).

### T+7d · Legacy retirement

- [ ] Delete Render service `virundhu-api-prod`.
- [ ] Archive `apps/api` and `apps/web` under `legacy/` tag in git.

### T+30d · Cost & perf review

- [ ] Supabase compute cost vs. Render+Neon baseline (target: ≥ 40% reduction).
- [ ] Compare `pg_stat_statements` p95 to `baseline-YYYYMMDD.md`.
- [ ] Close Stage 6 in `Docs/DevDoc_V2.md`.

---

## 7. Rollback

### 7.1 Abort triggers (any one → execute §7.2)

1. Auth signup or login error rate > 5% for 15m.
2. Order-create RPC error rate > 2% for 15m.
3. Payment capture success rate drops > 10pp vs. baseline for 30m.
4. Cross-tenant data leak detected (any confirmed report or
   `rls-cross-tenant.spec.ts` failure against prod).
5. Postgres CPU pinned > 90% for 15m with no clear query owner.
6. Any P0 CVE against a pinned dependency without a same-day patch.

### 7.2 Rollback procedure

Estimated recovery time: **≤ 30 minutes** end-to-end.

1. **Freeze writes**: Vercel env var `SPA_MAINTENANCE=1` → SPA serves the
   maintenance page.
2. **DNS**: Flip `app.virundhu.com` back to the legacy Render frontend.
   TTL is 60s during cutover window (§6 T-2h), so propagation ≤ 2m.
3. **Re-enable legacy API**: on Render, remove the 503 short-circuit and
   redeploy `virundhu-api-prod`.
4. **Data**: If any users signed up during the incident window against
   Supabase Auth, export them via `supabase auth admin listUsers` → CSV
   → forward to legacy Prisma as a manual reconciliation task.
5. **Comms**: Post to `#customers` and status page with the cause and
   the ETA to re-attempt.

Rollback rehearsed at least once per week during the T-72h → T-0 window.

---

## 8. Subsystem Runbooks

### 8.1 Auth & signup

**Owner**: Backend lead
**Code**: `supabase/functions/auth-signup/`, `supabase/migrations/20260901001800_rpc_provision_tenant.sql`, `packages/client/src/auth.ts`

Common failures:

- `SLUG_TAKEN` (409) — expected, surfaces in the SPA form. No action.
- `PROVISION_FAILED` (500) — see Sentry stack. Typically an RLS drift
  after a migration. Reproduce with:
  ```sql
  select public.provision_tenant('00000000-0000-0000-0000-000000000001'::uuid,'Test Store','test-store','Test Owner');
  ```
- New user cannot see their store — check
  `auth.users.raw_app_meta_data.store_ids` is populated. If empty, the
  post-provision `updateUserById` call failed silently; re-run manually:
  ```ts
  await admin.auth.admin.updateUserById(userId, { app_metadata: { store_ids: [storeId], role: "OWNER" } });
  ```

### 8.2 Orders (create / advance)

**Owner**: Backend lead
**Code**: `supabase/migrations/20260901001300_rpc_orders_create.sql`,
`supabase/migrations/20260901001400_rpc_orders_status.sql`,
`packages/client/src/repos/orders.ts`

- Order-number collisions surface as SQLSTATE `23505` on
  `orders_store_order_number_key`. The RPC retries once with a
  fresh `next_order_number`; if it still fails, we're out of the
  daily 4-digit window → widen to 5 digits in a forward migration.
- Illegal transition (`PLACED → COMPLETED` etc.) returns SQLSTATE
  `22023`. Confirm the transition table matches
  `packages/shared/src/transitions.ts`.

### 8.3 Public menu & checkout

**Owner**: Frontend lead
**Code**: `apps/spa/api/menu/[slug].ts`, `apps/spa/src/routes/menu.$slug.tsx`

- If `/api/menu/[slug]` returns 500, check Vercel logs — usually an
  expired Supabase anon key. Rotate via Supabase Studio → Settings → API
  and update the SPA env var `VITE_SUPABASE_ANON_KEY`.
- Cache hit ratio (X-Vercel-Cache) < 60% for 24h → someone deployed with
  the `Cache-Control` header stripped. Verify handler still returns
  `public, s-maxage=60, stale-while-revalidate=300`.

### 8.4 Payments (Razorpay)

**Owner**: Finance ops (business) · Backend lead (code)
**Code**: `supabase/functions/razorpay-webhook/`,
`supabase/functions/_shared/razorpay.ts`,
`supabase/migrations/20260901002300_stage5_payments_notify.sql`

- Signature failures (`INVALID_SIGNATURE` in Sentry) — 99% of the time
  the webhook secret drifted after a Razorpay dashboard rotation.
  Update `RAZORPAY_WEBHOOK_SECRET` on the prod function and redeploy.
- Duplicate captures — the `idempotency_keys` table blocks these at the
  DB layer via `mark_payment_paid`. If you see two `orders.payment_status
  = 'PAID'` transitions for the same order in audit, that's a bug —
  file a P1.
- Refunds are **out of scope** for Stage 6 — handle manually via
  Razorpay dashboard + a follow-up SQL to set
  `orders.payment_status = 'REFUNDED'`.

### 8.5 Database (RLS, perf, materialized views)

**Owner**: Backend lead
**Code**: `supabase/migrations/20260901000900_rls.sql`,
`supabase/migrations/20260901002400_stage6_perf_hardening.sql`

- **Slow query** → open Supabase Studio → Query Performance →
  sort by "Mean exec time". If a query on `orders` shows a Seq Scan,
  confirm `orders_store_placed_idx` and `orders_store_status_placed_idx`
  exist (Stage 6 §6.3). Rebuild if missing:
  ```sql
  create index concurrently orders_store_status_placed_idx
    on public.orders (store_id, status, placed_at desc);
  ```
- **Materialized view stale** — dashboard shows yesterday's numbers.
  ```sql
  select * from extensions.cron.job_run_details
   where jobname = 'virundhu_refresh_metrics'
   order by end_time desc limit 5;
  ```
  If the last run > 30m ago, refresh manually:
  ```sql
  refresh materialized view concurrently public.store_daily_metrics;
  ```
- **RLS regression** — the pgTAP suite in `supabase/tests/` catches
  most. If a manual test shows tenant A reading tenant B, immediately
  execute §7.2. Then reproduce with:
  ```sql
  set local role authenticated;
  set local "request.jwt.claims" to '{"sub":"<tenant-a-uid>","app_metadata":{"store_ids":["<tenant-a-store>"]}}';
  select count(*) from public.orders where store_id = '<tenant-b-store>';
  -- MUST be 0.
  ```

### 8.6 Scheduled jobs (`pg_cron`)

**Owner**: Backend lead
**Code**: `supabase/migrations/20260901001700_cron_keepalive.sql`,
`supabase/migrations/20260901002400_stage6_perf_hardening.sql`

Job inventory:

| Job                          | Cron           | Purpose                                       |
| ---------------------------- | -------------- | --------------------------------------------- |
| `virundhu_keepalive`         | `0 */6 * * *`  | Prevent free-tier project pause               |
| `virundhu_refresh_metrics`   | `*/5 * * * *`  | Refresh `store_daily_metrics` materialized view |

Verify:

```sql
select jobname, schedule, active from extensions.cron.job;
select jobname, status, return_message, start_time
  from extensions.cron.job_run_details
 order by start_time desc limit 20;
```

If a job is inactive, re-enable:

```sql
update extensions.cron.job set active = true where jobname = '<name>';
```

### 8.7 Notifications (WhatsApp / email fan-out)

**Owner**: Backend lead
**Code**: `supabase/functions/notify-order-transition/`,
`supabase/migrations/20260901002300_stage5_payments_notify.sql`

- The DB fan-out is `pg_net`-based and best-effort — **never blocks the
  order write**. If notifications stop, orders still work.
- Check `app.edge_url` and `app.edge_secret` GUCs are set at the prod
  project (Settings → Database → Config). If unset, the fan-out is a
  silent no-op (guarded in the trigger).
- To manually retry a fan-out for a specific order:
  ```sql
  select public.notify_order_transition('<order-id>'::uuid, 'PLACED', 'ACCEPTED');
  ```

### 8.8 Realtime channels

**Owner**: Frontend lead
**Code**: `apps/spa/src/lib/useOrdersRealtime.ts`,
`packages/client/src/repos/orders.ts`

- The `/orders/live` view subscribes to
  `postgres_changes` on `public.orders` filtered by `store_id`. Auth is
  via the SPA's session JWT — RLS enforces the tenant scope.
- If live orders don't appear: confirm the Supabase project has Realtime
  enabled for the `public.orders` table (Studio → Database → Replication).
- Reconnect storms → check for a Vercel deploy loop firing session
  invalidations. The client already backs off exponentially (see
  `useOrdersRealtime.ts`).

---

## 9. QA Gates (per stage promotion)

Every stage promotion (staging → prod) MUST show:

1. `npm run test` at repo root — all Node suites green.
   - `@virundhu/shared` — schemas, transitions, notifications
   - `@virundhu/client` — errors, queryKeys, session-store
   - `@virundhu/spa` — cart, edge menu handler
2. `deno test --import-map=supabase/import_map.json supabase/functions/**/*.test.ts` — Deno suites green (Razorpay HMAC, bcrypt guard).
3. `supabase test db` — pgTAP files `00`–`06`.
4. `pnpm --filter @virundhu/spa test:e2e` — Playwright smoke + auth + checkout + `rls-cross-tenant`.
5. k6 baseline within thresholds (§6.3): p95 < 600ms, error rate < 0.5%.
6. Bundle size gate: `pnpm --filter @virundhu/spa build` reports ≤ 180 KB gzip.

If any gate is red, **do not promote**. Fix forward.

---

## 10. Operator-only Stage 6 follow-ups (deferred)

These items are gated on cloud access this repo does not have; they are
tracked here so nothing is lost.

- [ ] Provision `virundhu-staging` and `virundhu-prod` Supabase projects;
      populate `.env.production` for the SPA.
- [ ] Create Sentry projects `virundhu-spa` and `virundhu-edge`; wire
      DSNs into Vercel + Supabase function env.
- [ ] Set Better Stack HTTP monitors on `/login`, `/menu/anna-street-food`,
      `/api/menu/anna-street-food`, `/api/order-lookup`.
- [ ] Configure `app.edge_url` and `app.edge_secret` GUCs on prod for
      `notify_order_transition` fan-out to reach `notify-order-transition`.
- [ ] Rotate `IMPORT_SECRET` after cutover completes; remove the
      `admin-user-import` function deployment (or leave with the rotated
      secret for future imports).
- [ ] Capture the first k6 baseline and commit
      `Docs/perf/baseline-<YYYYMMDD>.md`.
