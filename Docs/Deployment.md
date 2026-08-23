# Virundhu · Deployment Guide

**Target stack (Phase 2, free tier):**

| Layer     | Provider   | Plan  | Why                                                    |
| --------- | ---------- | ----- | ------------------------------------------------------ |
| Frontend  | **Vercel** | Free  | First-party Next.js hosting, instant edge CDN          |
| Backend   | **Render** | Free  | Native Node/NestJS, generous free tier, easy env mgmt  |
| Database  | **Supabase** Postgres | Free | Persistent (no 90-day expiry), 500 MB, free daily backups |
| Domain    | _Later_    | —     | Add a custom domain any time; both hosts support it    |

**Explicitly deferred to Phase 3 (do not add now):**

- ❌ Razorpay
- ❌ WhatsApp (Twilio / WhatsApp Cloud API)
- ❌ Redis
- ❌ WebSockets

The current app is fully functional without any of the above — Phase 2 orders are simulated, and the UI uses polling instead of sockets. Skipping these keeps your monthly bill at **₹0**.

---

## 0 · Prerequisites

You need three free accounts (all sign up with GitHub in ~1 min each):

1. **GitHub** — <https://github.com/signup> (host the code)
2. **Supabase** — <https://supabase.com> (Postgres database)
3. **Render** — <https://render.com> (API host)
4. **Vercel** — <https://vercel.com> (frontend host)

Local tools: **Node 20+**, **git**.

Verify Node:

```bash
node --version    # → v20.x or newer
```

---

## 1 · File-level changes already applied

Everything below is already committed on your branch — this section documents _what_ was changed so you understand the moving parts.

### 1.1 `apps/api/prisma/schema.prisma`

```prisma
datasource db {
  provider = "postgresql"   // ← was "sqlite" during Phase 1
  url      = env("DATABASE_URL")
}
```

SQLite is a single file; on any managed host that file is wiped on redeploy. Postgres is required for persistence.

### 1.2 `apps/api/prisma/migrations/…/migration.sql`

The initial migration was regenerated in Postgres DDL (`TIMESTAMP(3)`, `DECIMAL(10,2)`, proper foreign-key syntax). You don't need to touch it.

### 1.3 `apps/api/package.json`

Two scripts relevant to production:

```json
"start:prod":            "prisma migrate deploy && node dist/main.js",
"prisma:migrate:deploy": "prisma migrate deploy"
```

- **`start:prod`** — runs Prisma inside the `@cartsas/api` workspace, where the Prisma CLI is always on PATH. Used for local production smoke-tests.
- **`prisma:migrate:deploy`** — called by Render's `startCommand` via `npm run prisma:migrate:deploy --workspace=@cartsas/api`. Delegating through `npm run --workspace=` guarantees the workspace's own `node_modules/.bin` is used, so the Prisma binary is always found regardless of npm hoisting behaviour on Render's build machines.

### 1.4 `apps/api/src/modules/health/*`

New endpoints for uptime checks:

- `GET /api/health` — process is alive
- `GET /api/health/ready` — process + database round-trip

Render uses `/api/health` as its health-check probe.

### 1.5 `apps/api/src/main.ts` — CORS accepts wildcards

`CORS_ORIGIN` is a comma-separated list; each entry can now be:

- an exact origin — `https://virundhu.vercel.app`
- a **wildcard** host — `https://*.vercel.app` (matches every Vercel preview URL automatically)
- `*` to allow anything (not recommended)

This means you set the env var once and every preview deploy just works.

### 1.6 `render.yaml`

Repo-root blueprint. Declares one Render service (the API). Marks `DATABASE_URL` and `CORS_ORIGIN` as `sync: false` (paste in dashboard) and auto-generates `JWT_SECRET`.

Key commands in the blueprint (both intentionally delegate into the workspace so Prisma is always on PATH):

```yaml
buildCommand: npm ci && npm run build:api
startCommand: npm run prisma:migrate:deploy --workspace=@cartsas/api && node apps/api/dist/main.js
```

> **Why not `npx prisma generate` in the build command?**
> `prisma generate` is already invoked automatically by `@prisma/client`'s postinstall hook during `npm ci`, and again as part of `nest build`. Adding a third `npx prisma generate` at the repo root was redundant **and** unreliable — `npx` at the repo root cannot guarantee it resolves the binary from `apps/api/node_modules/.bin/` rather than a stale global install. Removing it makes the build deterministic.

### 1.7 `apps/web/vercel.json`

Tells Vercel how to build the Next.js app from inside the monorepo:

```json
{
  "buildCommand": "cd ../.. && npm run build:shared && npm run build:web",
  "installCommand": "cd ../.. && npm ci",
  "outputDirectory": ".next",
  "framework": "nextjs"
}
```

Vercel sees the `apps/web` folder and reads this file; the commands step up to the monorepo root so npm workspaces resolve correctly.

### 1.8 `.env.example` files

Both updated with production-ready comments so a new developer knows exactly what values to paste where.

---

## 2 · Step 1 — Supabase (Database)

Supabase gives you a persistent Postgres with a web UI, daily backups, and no expiry on the free tier.

### 2.1 Create the project

1. Log in at <https://supabase.com/dashboard>.
2. **New project** → name `virundhu-prod` → region **Mumbai** (`ap-south-1`) → generate a strong DB password → **Create**.
3. Wait ~90 seconds for provisioning.

> **Save the DB password in your password manager now.** Supabase never shows it again — if lost, you'll have to reset it under _Project Settings → Database_.

### 2.2 Copy the pooled connection string

1. In your project, open **Project Settings → Database → Connection string**.
2. Select the **URI** tab.
3. Under **Connection pooling**, pick **Transaction mode**, port **6543**.
4. Copy the string — it looks like:

   ```
   postgresql://postgres.<ref>:<PASSWORD>@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
   ```

5. Replace `<PASSWORD>` with the password from step 2.1.
6. Add `?pgbouncer=true&connection_limit=1` at the end. Final form:

   ```
   postgresql://postgres.<ref>:<PASSWORD>@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
   ```

> **Why pooled (6543) and not direct (5432)?** Render's free plan spins up multiple short-lived workers. The transaction pooler handles bursty connections cleanly; direct connections would exhaust your Supabase quota fast.
>
> **Why `pgbouncer=true`?** Tells Prisma to disable prepared statements, which PgBouncer's transaction mode doesn't support.

### 2.3 (Optional but recommended) Enable Point-in-Time Recovery

Free tier includes 1 daily backup for 7 days. That's fine for now — you can upgrade later.

---

## 3 · Step 2 — Push to GitHub

If you haven't already:

```bash
cd /path/to/CartSas
git add .
git commit -m "chore: hosting-ready (Vercel + Render + Supabase)"
gh repo create virundhu --private --source=. --push   # or use the GitHub UI
```

Both Vercel and Render deploy on every push to `main`, so this is the only "deploy trigger" you'll ever need.

---

## 4 · Step 3 — Render (Backend API)

### 4.1 Deploy via Blueprint

1. Log in at <https://dashboard.render.com>.
2. **New** → **Blueprint**.
3. Connect your GitHub → select the `virundhu` repo.
4. Render reads `render.yaml` and shows one service: **virundhu-api**.
5. Click **Apply**. First deploy starts (~4–6 min).

Meanwhile, set the two secrets Render is waiting for:

### 4.2 Set env vars in the Render dashboard

Open **virundhu-api → Environment**:

| Key            | Value                                                         |
| -------------- | ------------------------------------------------------------- |
| `DATABASE_URL` | Paste the Supabase pooled URL from step 2.2                   |
| `CORS_ORIGIN`  | `https://virundhu.vercel.app,https://*.vercel.app` _(temp, we'll refine after Vercel is up — see 5.3)_ |

`JWT_SECRET` was auto-generated. Everything else (`PORT`, `NODE_VERSION`, `JWT_EXPIRES_IN`, `BCRYPT_ROUNDS`) has a default in `render.yaml`.

Click **Save Changes** — Render redeploys automatically.

### 4.3 Verify

Once the build turns green, open a terminal:

```bash
curl https://virundhu-api.onrender.com/api/health
# → {"status":"ok","uptime": …}

curl https://virundhu-api.onrender.com/api/health/ready
# → {"status":"ok","database":"ok"}
```

If `/ready` returns `database: "error"`, your `DATABASE_URL` is wrong — see **Troubleshooting**.

Also browse **Swagger UI**: `https://virundhu-api.onrender.com/api/docs`.

**Note the URL** — you need it for the next step: `https://virundhu-api.onrender.com/api`.

---

## 5 · Step 4 — Vercel (Frontend)

### 5.1 Import the project

1. Log in at <https://vercel.com/new>.
2. Import the same GitHub repo (`virundhu`).
3. **Root Directory** → click **Edit** → select `apps/web`. ← _this is the single most important click on this page_
4. **Framework Preset** → Vercel auto-detects **Next.js** ✅.
5. Leave **Build / Install commands** empty — `apps/web/vercel.json` fills them in.
6. Expand **Environment Variables** and add:

   | Key                        | Value                                         |
   | -------------------------- | --------------------------------------------- |
   | `NEXT_PUBLIC_API_URL`      | `https://virundhu-api.onrender.com/api`       |
   | `NEXT_PUBLIC_REPO_BACKEND` | `api`                                         |

   Apply both to **Production**, **Preview**, and **Development**.

7. Click **Deploy**. First build ~3 min.

### 5.2 Verify

- Open the deployed URL (Vercel shows it — usually `https://virundhu.vercel.app` or `https://virundhu-<hash>.vercel.app`).
- Homepage should render the redesigned landing page.
- Click **Start free** → complete signup.
- You should land on the dashboard with a fresh store — no `NEXT_PUBLIC_API_URL is not set` errors in the browser console.

### 5.3 Tighten `CORS_ORIGIN` (optional but good hygiene)

Once you know your Vercel production URL, edit `CORS_ORIGIN` on Render to:

```
https://<your-app>.vercel.app,https://*.vercel.app
```

The `*.vercel.app` half is important — every PR gets a preview URL like `virundhu-git-feature-x-you.vercel.app`, and this wildcard covers all of them.

**Save** → Render redeploys the API (~2 min). Preview URLs, production URL, and localhost:3000 all work simultaneously.

---

## 6 · Step 5 — End-to-end smoke test

Run through this list once. Everything should just work:

- [ ] `GET https://virundhu-api.onrender.com/api/health` → `200 ok`
- [ ] `GET https://virundhu-api.onrender.com/api/health/ready` → `database: ok`
- [ ] Vercel URL loads the landing page
- [ ] Sign up → dashboard opens with the new store
- [ ] Create a category and a product
- [ ] Open **QR** page → the public menu URL loads on your phone
- [ ] Place a test order from the phone → appears on **Live Orders**
- [ ] Sign out → returns to `/login` (should be instant since P2-31 fix)

---

## 7 · Local dev against Supabase

You have two options:

### Option A — Docker Postgres (fastest, isolated)

```bash
docker run -d --name virundhu-pg \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=virundhu \
  -p 5432:5432 postgres:16
```

Then set `apps/api/.env`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/virundhu?schema=public"
```

Apply migrations + seed:

```bash
npm run db:migrate --workspace=@cartsas/api   # create dev migration
npm run db:seed                               # optional seed data
```

### Option B — Supabase "development" branch (recommended once you're used to it)

Supabase lets you branch a database like git. Free tier supports 2 branches at a time.

1. In the Supabase dashboard, open your project → **Branches** → **New branch** → name it `dev`.
2. Copy the branch's own pooled connection string.
3. Use it as `DATABASE_URL` in your local `.env`.

Result: local dev writes to a real Postgres that mirrors production's schema without touching prod data.

---

## 8 · Deploying updates

Zero-config after step 5:

```bash
git add .
git commit -m "feat: whatever"
git push
```

- Render rebuilds the API and runs `prisma migrate deploy` automatically.
- Vercel rebuilds the web app and swaps the CDN atomically.
- Both auto-deploys land in ~3–5 min.

---

## 9 · Backups & disaster recovery

Supabase free tier: **1 backup per day, 7-day retention**.

- Dashboard → **Database** → **Backups** → **Restore**.
- You can also click **Download** to grab a compressed dump for cold storage.

Manual off-site dump (once a week, ~30 s):

```bash
pg_dump "$SUPABASE_URL" | gzip > virundhu-$(date +%F).sql.gz
```

Store the file in Google Drive / Dropbox / iCloud.

---

## 10 · Adding a custom domain (when ready)

You can do this on either or both hosts — do it whenever you're ready to stop using `*.vercel.app` and `*.onrender.com`.

### 10.1 Frontend — `app.virundhu.in`

1. Vercel → **Project → Settings → Domains** → add `app.virundhu.in`.
2. At your DNS provider (GoDaddy / Cloudflare / Namecheap), create the record Vercel shows — typically a `CNAME` to `cname.vercel-dns.com`.
3. TLS provisions automatically (~2 min).

### 10.2 Backend — `api.virundhu.in`

1. Render → **virundhu-api → Settings → Custom Domain** → add `api.virundhu.in`.
2. Add the `CNAME` Render shows (to `<something>.onrender.com`).
3. On Vercel, update `NEXT_PUBLIC_API_URL` to `https://api.virundhu.in/api` and redeploy.
4. On Render, update `CORS_ORIGIN` to `https://app.virundhu.in,https://*.vercel.app`.

---

## 11 · Cold starts (free-tier characteristic)

Render's free plan sleeps the API after 15 minutes of no traffic. First request after sleep waits 30–50 s. Options:

- **Live with it** during Phase 2 — the app already shows a loading state, and admins rarely hit a cold start.
- **Cron ping** — set up a free UptimeRobot monitor hitting `/api/health` every 5 min. Free-tier legal, keeps the API warm during business hours.
- **Upgrade** to Render's Starter plan ($7/mo) whenever you want zero cold starts.

Vercel and Supabase do **not** have cold starts on the free tier.

---

## 12 · Troubleshooting

### Vercel build fails: "Cannot find module '@cartsas/shared'"

- Root directory must be `apps/web`.
- Confirm `apps/web/vercel.json` is committed (build command steps up to the monorepo root).
- Confirm the root `package.json` has `"workspaces": ["apps/*", "packages/*"]`.

### Vercel build fails: "NEXT_PUBLIC_API_URL is not set"

Set the env var under **Project → Settings → Environment Variables** for Production _and_ Preview _and_ Development, then click **Redeploy**. Public vars must exist at build time.

### Render build fails: "P3005: The database schema is not empty"

You attempted `migrate deploy` on a DB that already has tables from another tool. Reset the Supabase project (Dashboard → **Settings → General → Reset database**) or run `prisma migrate resolve --applied <migration_name>` once from your machine.

### Render `/api/health/ready` returns `database: "error"`

- Check `DATABASE_URL` in Render → **Environment**. The password must be URL-encoded if it contains `@`, `#`, `:`, `/`, `?`, `%`, `&` — use `encodeURIComponent()` or just regenerate the DB password with alphanumerics only.
- Confirm you used the **pooled** URL (port `6543`) with `?pgbouncer=true&connection_limit=1`.
- Confirm the Supabase project is not paused (free-tier projects pause after 7 days of no activity — un-pause from the dashboard).

### Browser shows CORS error

- API `CORS_ORIGIN` must include your Vercel URL exactly (scheme + host, no trailing slash).
- For preview URLs, add `https://*.vercel.app`.
- After changing `CORS_ORIGIN` on Render, wait for the redeploy to finish before retrying.

### Signup succeeds but dashboard is stuck loading

- Open browser DevTools → **Network**. Requests should go to `https://virundhu-api.onrender.com/api/...`.
- If they go to `/api/...` (relative), `NEXT_PUBLIC_API_URL` is missing on Vercel — see fix above.

### Prisma "Too many connections"

You used the direct URL (`5432`) instead of the pooler URL (`6543`). Swap it in Render's env vars.

### Render deploy log says "Killed"

You hit the 512 MB build memory limit. Rarely happens on this project. If it does, add `NODE_OPTIONS=--max-old-space-size=460` as an env var.

---

## 13 · Cost summary

| Item              | Free tier limit                                     | When to upgrade                                             |
| ----------------- | --------------------------------------------------- | ----------------------------------------------------------- |
| Vercel Hobby      | 100 GB bandwidth/month, unlimited sites             | Commercial use → **Pro** $20/mo                             |
| Render Free (web) | 750 hr/month, cold-starts after 15 min idle         | Zero cold starts → **Starter** $7/mo                        |
| Supabase Free     | 500 MB DB, 1 GB file storage, 2 GB egress, paused after 7 days idle | > 500 MB data → **Pro** $25/mo (8 GB, no pause) |

**Baseline: ₹0/month.** Realistic first upgrade: Render Starter ($7/mo) once you have real customers hitting the API and cold starts become visible.

---

## 14 · What's explicitly _not_ in this deployment

These are deferred to Phase 3 — do **not** add them yet:

- ❌ **Razorpay** — payments are simulated in Phase 2; wiring live payments needs KYC + business account, out of scope.
- ❌ **WhatsApp** — no Twilio/Cloud API integration, no phone-number cost, no template approvals.
- ❌ **Redis** — polling + Postgres advisory locks are sufficient at current scale.
- ❌ **WebSockets** — the Live Orders page uses HTTP polling (see `useCollection`); good enough up to ~30 orders/min.

Skipping these keeps setup under 30 minutes and monthly cost at zero.

---

## 15 · Printable checklist

```
□ GitHub repo pushed
□ Supabase project created (region: Mumbai)
□ Supabase pooled URL copied (port 6543, ?pgbouncer=true&connection_limit=1)
□ Render blueprint applied
□ Render env: DATABASE_URL set
□ Render env: CORS_ORIGIN set (Vercel URL + *.vercel.app)
□ Render /api/health returns ok
□ Render /api/health/ready returns database:ok
□ Vercel project imported with Root Directory = apps/web
□ Vercel env: NEXT_PUBLIC_API_URL set (with /api suffix)
□ Vercel env: NEXT_PUBLIC_REPO_BACKEND = api
□ Landing page loads on the Vercel URL
□ Signup → dashboard round-trip works
□ Public menu URL from QR page opens on phone
□ Test order visible on Live Orders
□ Sign-out returns to /login cleanly
```

You're live. 🎉
