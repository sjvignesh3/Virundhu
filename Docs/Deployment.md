# Virundhu · Hassle-free Hosting Guide

> One-time setup: **~30 minutes**.
> Ongoing cost on the free tier: **₹0/month** (with a ~30s cold start on the API).
> Recommended paid tier: **~$7/month** (Render Starter) for always-warm API.

This guide walks you through hosting the Virundhu monorepo end-to-end:

| Piece | Where it lives | Why |
|---|---|---|
| Next.js web (`apps/web`) | **Render** — Web Service | Fast global CDN, Git-push deploys |
| NestJS API (`apps/api`)  | **Render** — Web Service | Same platform → simple ops |
| PostgreSQL database      | **Neon** — Serverless Postgres | Never expires on free tier · daily branches/backups · point-in-time restore · **safer & more persistent than Render's free DB, which is deleted after 90 days** |

Everything is committed as code: a Render **Blueprint** (`render.yaml`) provisions both services, and Neon is set up once via the web UI.

---

## Table of contents

1. [Prerequisites](#1-prerequisites)
2. [File-level changes already applied](#2-file-level-changes-already-applied)
3. [Step 1 · Create the Postgres database on Neon](#3-step-1--create-the-postgres-database-on-neon)
4. [Step 2 · Push the repo to GitHub](#4-step-2--push-the-repo-to-github)
5. [Step 3 · Deploy both services on Render via Blueprint](#5-step-3--deploy-both-services-on-render-via-blueprint)
6. [Step 4 · Wire the two services together](#6-step-4--wire-the-two-services-together)
7. [Step 5 · Verify the deployment](#7-step-5--verify-the-deployment)
8. [Local development against a Postgres DB](#8-local-development-against-a-postgres-db)
9. [Backups, restore & safety](#9-backups-restore--safety)
10. [Custom domains](#10-custom-domains)
11. [Ongoing operations](#11-ongoing-operations)
12. [Troubleshooting](#12-troubleshooting)
13. [Cost summary](#13-cost-summary)

---

## 1. Prerequisites

You will need free accounts on:

| Service | Sign-up URL | Notes |
|---|---|---|
| GitHub | https://github.com | To host the code Render will pull from |
| Render | https://render.com | Uses your GitHub login |
| Neon   | https://neon.tech  | Uses your GitHub login |

Local tools:

```bash
node --version   # must be >= 20
npm --version
git --version
```

---

## 2. File-level changes already applied

The repo has been prepared for you. Here is what changed and **why** — no further edits are required unless you want to customise regions or plans.

### 2.1 `apps/api/prisma/schema.prisma` — switched provider to `postgresql`

```prisma
datasource db {
  provider = "postgresql"    // was: "sqlite"
  url      = env("DATABASE_URL")
}
```

*Why:* SQLite writes to a file on disk. Render's free tier has **ephemeral disks** — every restart wipes it. Postgres (managed by Neon) is durable and backed up.

### 2.2 `apps/api/prisma/migrations/20260823110930_init/migration.sql` — rewritten for Postgres

The initial migration now uses:
- `TIMESTAMP(3)` instead of `DATETIME`
- `DECIMAL(10,2)` for money columns (SQLite had no real Decimal type)
- Proper `CONSTRAINT ... PRIMARY KEY` and `FOREIGN KEY` syntax

The migration folder's lockfile is also switched:

```toml
# apps/api/prisma/migrations/migration_lock.toml
provider = "postgresql"
```

### 2.3 `apps/api/package.json` — added `start:prod`

```json
"start:prod": "prisma migrate deploy && node dist/main.js"
```

*Why:* On every deploy, Render runs this so pending migrations are applied **before** the server begins serving traffic. `migrate deploy` (unlike `migrate dev`) never prompts and never drops data — safe for production.

### 2.4 `apps/api/src/modules/health/health.controller.ts` — new health endpoints

- `GET /api/health` → liveness (unauthenticated, cheap).
- `GET /api/health/ready` → verifies DB connectivity.

Render polls `/api/health` every few seconds and only routes traffic to instances that reply `200`. This kills a whole class of "silent failure" outages.

### 2.5 `render.yaml` — the Render Blueprint (root of repo)

Declares both services (`virundhu-api`, `virundhu-web`) with their build/start commands, region (`singapore`), plan, health check, autodeploy, and every env var. `sync: false` marks the two secrets you paste in the dashboard. Everything else is either literal or auto-generated.

### 2.6 `.env.example` — updated defaults

`apps/api/.env.example` now shows a Postgres connection string as the default, so local `.env` files start correct.

---

## 3. Step 1 · Create the Postgres database on Neon

**Why Neon and not Render Postgres?**

| | Neon Free | Render Postgres Free |
|---|---|---|
| Retention | **Unlimited** | **Deleted after 90 days** |
| Storage | 0.5 GB | 1 GB |
| Backups | Point-in-time restore, 7 days | Daily snapshot only |
| Branching | Yes (great for staging) | No |
| Cold start | ~300 ms (auto-resume) | Always on |
| Cost to keep going | $0 forever | Must upgrade to $7/mo after 90 days |

For a persistent, safe production database, **Neon** wins.

### 3.1 Create the project

1. Go to <https://neon.tech> → **Sign up with GitHub**.
2. Click **New Project**.
3. Settings:
   - **Project name:** `virundhu`
   - **Postgres version:** 16 (default)
   - **Region:** `Asia Pacific (Singapore) — aws-ap-southeast-1` (closest to Tamil Nadu)
   - **Database name:** `virundhu`
4. Click **Create project**.

### 3.2 Copy the connection string

On the project dashboard you will see a **Connection string** panel:

- Make sure the toggle says **"Pooled connection"** (this uses PgBouncer — required for serverless-style spikes).
- Ensure the URL ends with `?sslmode=require`.
- Copy the whole string. It looks like:

  ```
  postgresql://virundhu_owner:XXXXXXXX@ep-cool-name-123456-pooler.ap-southeast-1.aws.neon.tech/virundhu?sslmode=require
  ```

- Save it in a password manager — you will paste it into Render in Step 3.

### 3.3 (Optional) Enable IP allow-listing later

For now Neon's default (encrypted, password-protected, TLS-required) is enough. If you upgrade to a paid Neon plan you can additionally restrict inbound IPs to Render's egress ranges.

---

## 4. Step 2 · Push the repo to GitHub

If you have not already:

```bash
cd /home/workspace/CartSas
git init                       # skip if already a repo
git add .
git commit -m "Prepare Virundhu for Render + Neon deployment"

# Create an empty repo on GitHub called "virundhu" (private is fine),
# then:
git remote add origin git@github.com:<your-username>/virundhu.git
git branch -M main
git push -u origin main
```

Confirm on github.com that `render.yaml` sits at the repository root. Render finds the blueprint by that filename.

---

## 5. Step 3 · Deploy both services on Render via Blueprint

### 5.1 Create the blueprint

1. Sign in to <https://dashboard.render.com>.
2. Top-right → **New** → **Blueprint**.
3. Connect the GitHub account & pick the `virundhu` repo.
4. Render reads `render.yaml` and shows a preview:
   - `virundhu-api` (Web Service, Node, Singapore, free)
   - `virundhu-web` (Web Service, Node, Singapore, free)
5. Click **Apply**.

Render will now create both services. The first build takes **5-8 minutes** because it installs the whole monorepo. Subsequent deploys are ~2 minutes thanks to build caching.

### 5.2 Set the two secrets Render prompted for

While the services are still building, click **virundhu-api → Environment** and set:

| Key | Value |
|---|---|
| `DATABASE_URL` | Paste the Neon pooled connection string from **§3.2** |
| `JWT_SECRET` | (auto-generated — leave the value Render created) |

`CORS_ORIGIN` will already be auto-filled by Render to the web service's hostname (see `render.yaml`).

Click **Save Changes** — Render triggers a fresh deploy of the API using the new env vars.

---

## 6. Step 4 · Wire the two services together

After **`virundhu-api`** finishes deploying it gets a public URL such as:

```
https://virundhu-api.onrender.com
```

Now tell the web app about it:

1. Go to **virundhu-web → Environment**.
2. Edit `NEXT_PUBLIC_API_URL` and set:

   ```
   https://virundhu-api.onrender.com/api
   ```

   > ⚠ Include the trailing `/api` — the NestJS controllers are all mounted under that prefix (`app.setGlobalPrefix("api")` in `apps/api/src/main.ts`).

3. Save. Render redeploys the web service with the new value baked into the client bundle.

That is the last manual step.

---

## 7. Step 5 · Verify the deployment

### 7.1 API health

```bash
curl https://virundhu-api.onrender.com/api/health
# → {"status":"ok","uptime":42.13}

curl https://virundhu-api.onrender.com/api/health/ready
# → {"status":"ok","db":"reachable"}
```

If `/health/ready` returns 500, the database URL is wrong or migrations did not run — see [Troubleshooting](#12-troubleshooting).

### 7.2 API docs

Open <https://virundhu-api.onrender.com/api/docs> — you should see the Swagger UI with every route.

### 7.3 Web app + full signup flow

1. Open the web URL (e.g. `https://virundhu-web.onrender.com`).
2. Click **Start free** → complete the signup form.
3. You should land on the dashboard with all-zero metrics.
4. Log out from the topbar — you should hard-redirect to `/login`.
5. Log back in — data persists (it lives in Neon now).

---

## 8. Local development against a Postgres DB

The schema no longer supports SQLite, so local dev needs Postgres too. Two options:

### Option A · Docker (recommended, one command)

```bash
docker run -d --name virundhu-pg \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=virundhu \
  -p 5432:5432 \
  -v virundhu-pg-data:/var/lib/postgresql/data \
  postgres:16
```

Then in `apps/api/.env`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/virundhu?schema=public"
JWT_SECRET="dev-secret-change-me"
CORS_ORIGIN="http://localhost:3000"
```

Run migrations & start:

```bash
npm install
npm run db:migrate --workspace=@cartsas/api    # applies the init migration
npm run dev
```

### Option B · Use a Neon dev branch

Neon lets you create a free branch of your prod DB with one click.

1. Neon dashboard → **Branches → Create branch** → name it `dev`.
2. Copy that branch's connection string into `apps/api/.env`.
3. `npm run dev`.

You get a real copy of production data to develop against — reset it any time from the Neon UI without touching prod.

---

## 9. Backups, restore & safety

Neon does this automatically — you do not need cron jobs or manual `pg_dump` schedules.

| Feature | Free tier | What it does |
|---|---|---|
| **Point-in-time restore (PITR)** | last 7 days | Rewind DB to any second in the past 7 days |
| **Instant branches** | unlimited | Fork production into a throwaway DB for testing risky migrations |
| **Automatic checkpoints** | every ~10 min | Continuous WAL archiving underpins PITR |

### 9.1 To recover from an accidental data loss

1. Neon dashboard → your project → **Restore**.
2. Pick a timestamp before the incident.
3. Neon creates a new branch at that point.
4. Copy that branch's connection string.
5. Paste it into Render → `virundhu-api` → Environment → `DATABASE_URL` → Save.
6. Render redeploys with the restored DB. Done — total downtime ~2 minutes.

### 9.2 Manual off-site backup (extra caution)

If you want a nightly `.sql` file on your laptop:

```bash
# One-off snapshot to a local file (runs from anywhere with psql installed)
pg_dump "$NEON_CONNECTION_STRING" > virundhu-$(date +%F).sql
```

Automate this via a GitHub Actions cron if you want — but honestly, Neon PITR is enough for a Phase-2 app.

---

## 10. Custom domains

Both Render services support custom domains on the **free** plan.

### 10.1 Point `app.virundhu.in` at the web service

1. Render → `virundhu-web` → **Settings → Custom Domains → Add**.
2. Type `app.virundhu.in`.
3. Render shows a `CNAME` record — add it at your DNS provider (GoDaddy / Cloudflare / etc.):
   ```
   Type:  CNAME
   Name:  app
   Value: virundhu-web.onrender.com
   ```
4. Wait 5-15 minutes. Render auto-issues a Let's Encrypt TLS certificate.

### 10.2 Point `api.virundhu.in` at the API

Repeat with `api` → `virundhu-api.onrender.com`. Then update:

- `virundhu-web → Environment → NEXT_PUBLIC_API_URL = https://api.virundhu.in/api`
- `virundhu-api → Environment → CORS_ORIGIN = https://app.virundhu.in`

Redeploy both. Now the browser never sees `*.onrender.com`.

---

## 11. Ongoing operations

### 11.1 Deploy new code

Just push to `main`. Render's `autoDeploy: true` picks it up automatically.

```bash
git add .
git commit -m "feat: <what changed>"
git push
```

Both services rebuild in parallel. Deploy history is visible per service in the Render dashboard, and you can **Rollback** to any prior deploy with one click.

### 11.2 Add a new Prisma migration

```bash
# Local — Docker or Neon dev branch pointed at DATABASE_URL:
npx prisma migrate dev --name <descriptive_name> --schema=apps/api/prisma/schema.prisma

git add apps/api/prisma/migrations
git commit -m "db: <what changed>"
git push
```

On deploy, `start:prod` (invoked via the `render.yaml` startCommand) runs `prisma migrate deploy` **before** the server starts. Zero downtime for additive migrations.

### 11.3 Read logs

Render dashboard → the service → **Logs** tab → live tail. Also downloadable per deploy.

### 11.4 Free-tier cold starts

Render's free plan spins down a service after ~15 minutes of inactivity. The next request wakes it in ~30 seconds. Two mitigations:

1. **Cheap:** UptimeRobot (free) — set a 5-min HTTP monitor on `https://virundhu-api.onrender.com/api/health`. Keeps the API warm.
2. **Better:** Upgrade `virundhu-api` to **Starter ($7/mo)** in the Render dashboard — no cold starts, no monitor needed.

The web service already stays warm through incidental customer traffic once you launch.

---

## 12. Troubleshooting

### `/api/health/ready` returns 500 · `db: unreachable`

- Open Render → `virundhu-api` → **Logs**.
- Look for `PrismaClientInitializationError` or `ECONNREFUSED`.
- Common causes:
  - `DATABASE_URL` missing the `?sslmode=require` suffix → Neon rejects the connection.
  - You copied the **Direct** connection string instead of the **Pooled** one. Use the pooled URL for Render.
  - Neon project is paused — visit Neon dashboard once to auto-resume.

### CORS error in the browser · `blocked by CORS policy`

The API's `CORS_ORIGIN` env var does not match the browser's origin.

- Render → `virundhu-api` → Environment → `CORS_ORIGIN`.
- Set it to the **exact** scheme+host of your web app, comma-separated if you have several. Examples:
  - `https://virundhu-web.onrender.com`
  - `https://app.virundhu.in,https://virundhu-web.onrender.com` during a domain migration
- Save. API redeploys.

### `Cannot find module '@cartsas/shared'` during build

The build order is important: `shared` must build before `api`/`web`. `render.yaml`'s `buildCommand` already handles this (`npm run build:shared` first). If you see this locally, run:

```bash
npm install
npm run build:shared
```

### `PrismaClient is unable to run in this browser environment` (during Next.js build)

This means server-only code leaked into a client component. The web app never imports Prisma directly — it only calls the API. If you see this, check any recent additions in `apps/web/src` and revert.

### Login works but every subsequent request 401s

- Confirm `JWT_SECRET` on `virundhu-api` is a non-empty value.
- Confirm the web app is calling the correct base URL — visit `https://<your-web>/` → open DevTools → Network → click a request → the URL should match `NEXT_PUBLIC_API_URL`.
- If you rotated `JWT_SECRET`, all existing tokens are invalid — users must sign in again.

### The API cold-starts and the first login times out

Free-tier behaviour. Either add UptimeRobot or upgrade to Starter (see **§11.4**). The web app already retries login on network errors.

---

## 13. Cost summary

| | Free-tier setup | Zero-cold-start setup |
|---|---|---|
| Render web service | $0 | $0 (fine on free) |
| Render API service | $0 (30s cold start) | **$7/mo** (Starter) |
| Neon Postgres | $0 (0.5 GB, PITR 7d) | $0 or **$19/mo** for Launch (10 GB, PITR 30d) |
| Domain (optional) | ~₹800/yr for `.in` | ~₹800/yr |
| **Total** | **₹0/month** | **~$7-26/month** |

You can run the whole thing on ₹0 forever — the only reason to upgrade is customer-facing latency. Start on free, upgrade the API to Starter the day you onboard your first paying store.

---

## Quick-reference checklist

- [ ] Neon project created, pooled connection string copied.
- [ ] Repo pushed to GitHub with `render.yaml` at the root.
- [ ] Render Blueprint applied — `virundhu-api` + `virundhu-web` visible.
- [ ] `virundhu-api → DATABASE_URL` set to the Neon string.
- [ ] First API deploy finished; `/api/health/ready` returns 200.
- [ ] `virundhu-web → NEXT_PUBLIC_API_URL` set to `https://<api>/api`.
- [ ] Signup → dashboard → logout round-trip works in a browser.
- [ ] (Optional) UptimeRobot monitor on `/api/health` to defeat cold starts.
- [ ] (Optional) Custom domains + updated `NEXT_PUBLIC_API_URL` / `CORS_ORIGIN`.

You are live. 🎉
