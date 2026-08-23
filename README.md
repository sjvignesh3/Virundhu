# Cart SaaS — Food Cart Ordering & Operations Platform

> **Phase 2** — Full-stack application backed by NestJS + Prisma + SQLite (dev) / PostgreSQL (prod).

---

## What it does

A multi-tenant SaaS platform for street-food cart owners:

| Role | Experience |
|------|-----------|
| **Customer** | Scans QR → browses live menu → adds to cart → pays (simulated) → sees order confirmation |
| **Owner** | Logs in → monitors live Kanban board → accepts / prepares / completes orders → tracks revenue on dashboard |

---

## Architecture

```
apps/
  api/          NestJS + Prisma (backend)
  web/          Next.js 14 (frontend)
packages/
  shared/       Zod schemas + DTOs (shared by both apps)
```

### Request flow

```
Customer Browser / Owner Browser
        ↓  REST JSON
apps/web  (Next.js + API repos)
        ↓  fetch() with Bearer token
apps/api  (NestJS — Controllers → Services → Prisma)
        ↓  Prisma ORM
SQLite (dev)  /  PostgreSQL (prod)
```

---

## Quick start (local machine)

### Prerequisites

- Node.js 20+
- npm 10+

### 1 — Install

```bash
git clone <repo-url> CartSas
cd CartSas
npm install          # installs all workspaces in one step
```

### 2 — Configure environment

```bash
# API
cp apps/api/.env.example apps/api/.env
# Edit JWT_SECRET to a long random string for production.

# Web
cp apps/web/.env.example apps/web/.env.local
# NEXT_PUBLIC_API_URL defaults to http://localhost:4000/api — fine for local dev.
```

### 3 — Initialise the database

```bash
# Run migrations (creates apps/api/prisma/dev.db)
npm run db:migrate

# Seed demo data (Anna Street Food store + owner + products)
npm run db:seed
```

**Seed credentials:**
| Field | Value |
|-------|-------|
| Email | `owner@anna.test` |
| Password | `owner123` |
| Store slug | `anna-street-food` |

### 4 — Start both servers

```bash
npm run dev
```

| App | URL |
|-----|-----|
| Owner dashboard | http://localhost:3000/dashboard |
| Customer menu | http://localhost:3000/order/anna-street-food |
| API (NestJS) | http://localhost:4000/api |
| Swagger UI | http://localhost:4000/api/docs |

---

## End-to-end test workflow

This proves the full Phase 2 flow works:

1. Open **http://localhost:3000/login** — sign in as `owner@anna.test` / `owner123`.
2. Open **http://localhost:3000/dashboard** — confirm store data loads.
3. In a second browser tab (or phone), open **http://localhost:3000/order/anna-street-food**.
4. Add items (e.g. Chicken Kothu Parotta × 2 + Lemon Soda × 1).
5. Open cart → verify subtotal ₹280 → click **Pay ₹280 · Simulated**.
6. Confirmation screen shows order number (e.g. `FC-1001`).
7. Switch back to the owner tab → **Live Orders** page → `FC-1001` appears in **NEW**.
8. Tap the card → **Accept** → **Start Preparing** → **Mark Ready** → **Complete**.
9. Order disappears from the live board.
10. **Order History** shows the completed order.
11. **Dashboard** metrics update (revenue, completed orders).
12. **Reports** → Today → revenue reflects the order.

---

## NPM scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start API + web concurrently |
| `npm run dev:api` | NestJS API only (port 4000) |
| `npm run dev:web` | Next.js web only (port 3000) |
| `npm run build` | Production build (shared → api → web) |
| `npm test` | All tests (36 API + 54 web = 90 tests) |
| `npm run test:api` | Jest tests for NestJS backend |
| `npm run test:web` | Vitest tests for Next.js frontend |
| `npm run db:migrate` | Apply Prisma migrations |
| `npm run db:seed` | Seed demo data |
| `npm run db:reset` | Drop + re-migrate + re-seed |
| `npm run db:studio` | Open Prisma Studio (visual DB browser) |

---

## Switching to PostgreSQL (production)

1. Provision a PostgreSQL database.
2. Update `apps/api/.env`:
   ```env
   DATABASE_URL="postgresql://user:pass@host:5432/cartsas?schema=public"
   ```
3. Run migrations:
   ```bash
   npm run db:migrate
   npm run db:seed
   ```
4. No schema changes needed — the Prisma schema is Postgres-compatible.

---

## Environment variables

### `apps/api/.env`

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `file:./dev.db` | Prisma connection string |
| `JWT_SECRET` | *(required)* | HMAC secret for JWTs |
| `JWT_EXPIRES_IN` | `7d` | Token TTL |
| `PORT` | `4000` | API server port |
| `CORS_ORIGIN` | `http://localhost:3000` | Allowed frontend origins (comma-separated) |
| `BCRYPT_ROUNDS` | `10` | bcrypt cost factor |

### `apps/web/.env.local`

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000/api` | NestJS API base URL |
| `NEXT_PUBLIC_REPO_BACKEND` | `api` | `api` or `local` (Phase 1 offline demo) |

---

## Project structure

```
apps/api/
  prisma/
    schema.prisma       — database schema (SQLite dev / Postgres prod)
    migrations/         — Prisma migration history
    seed.ts             — demo data seed
    dev.db              — SQLite database file (git-ignored)
  src/
    modules/
      auth/             — JWT login, guards
      stores/           — store CRUD + settings
      categories/       — category CRUD
      products/         — product CRUD + availability
      orders/           — order creation (tx), state machine, history
      payments/         — SimulatedPaymentProvider (Razorpay slot)
      public/           — unauthenticated customer endpoints
      dashboard/        — aggregated metrics from DB
      reports/          — summary + CSV export
      printers/         — printer config CRUD
      settings/         — (thin wrapper, served by StoresController)
    common/
      errors/           — ApiException + error codes
      filters/          — GlobalExceptionFilter
      mappers/          — Prisma row → DTO converters + Decimal helpers
      pipes/            — ZodValidationPipe
    prisma/             — PrismaService (singleton)
    main.ts             — bootstrap + Swagger
    app.module.ts

apps/web/
  src/
    app/
      (owner)/          — owner route group (auth-guarded)
      login/            — sign-in page
      order/[slug]/     — customer ordering page + success
    components/         — UI primitives + owner shell
    features/           — customer-ordering, orders, products, categories, qr
    lib/
      api/              — apiFetch client, adapters, auth-api, session
      domain/           — pure domain logic (types, state machine, totals, csv)
      hooks/            — useCart, useDemoStore
      repositories/
        api/            — ApiStoreRepo, ApiCategoryRepo, ApiProductRepo, ApiOrderRepo
        local/          — localStorage repos (Phase 1 demo mode)
        factory.ts      — backend selector (api | local)
        repo-provider   — React context + useCollection hook
      services/         — order-service, payment-service
      seed/             — Phase 1 demo seed (local mode only)
      storage/          — localStorage wrapper + event-bus

packages/shared/
  src/
    enums.ts            — OrderStatus, PaymentStatus, Unit, … (const arrays + types)
    types.ts            — all API DTOs (StoreDTO, OrderDTO, …)
    schemas.ts          — Zod validation schemas (reused front + back)
    transitions.ts      — canTransition, nextValidStatuses (pure function)
    totals.ts           — computeOrderTotals (pure function)
    api-errors.ts       — ApiError class + ApiErrorBody shape
    index.ts            — barrel export
```

---

## API reference

Full interactive docs at **http://localhost:4000/api/docs** (Swagger UI).

### Public (no auth required)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/public/stores/:slug` | Store info + settings |
| GET | `/api/public/stores/:slug/categories` | Active categories |
| GET | `/api/public/stores/:slug/products` | Available products |
| POST | `/api/public/stores/:slug/orders` | Create order (transactional) |
| GET | `/api/public/stores/:slug/orders/:orderNumber` | Order receipt lookup |

### Owner (Bearer JWT required)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Login → JWT |
| GET | `/api/stores/:storeId` | Store details |
| PATCH | `/api/stores/:storeId` | Update store |
| GET/PATCH | `/api/stores/:storeId/settings` | Store settings |
| GET/POST | `/api/stores/:storeId/categories` | List / create |
| PATCH/DELETE | `/api/stores/:storeId/categories/:id` | Update / delete |
| GET/POST | `/api/stores/:storeId/products` | List / create |
| PATCH | `/api/stores/:storeId/products/:id` | Update |
| PATCH | `/api/stores/:storeId/products/:id/availability` | Toggle availability |
| DELETE | `/api/stores/:storeId/products/:id` | Soft/hard delete |
| GET | `/api/stores/:storeId/orders` | Paginated order history |
| GET | `/api/stores/:storeId/orders/active` | Live board orders |
| GET | `/api/stores/:storeId/orders/:id` | Order detail |
| POST | `/api/stores/:storeId/orders/:id/accept` | NEW → ACCEPTED |
| POST | `/api/stores/:storeId/orders/:id/prepare` | ACCEPTED → PREPARING |
| POST | `/api/stores/:storeId/orders/:id/ready` | PREPARING → READY |
| POST | `/api/stores/:storeId/orders/:id/complete` | READY → COMPLETED |
| POST | `/api/stores/:storeId/orders/:id/cancel` | → CANCELLED |
| GET | `/api/stores/:storeId/dashboard` | Aggregated today metrics |
| GET | `/api/stores/:storeId/reports` | Summary by date range |
| GET | `/api/stores/:storeId/reports/orders.csv` | CSV export |
| GET/POST | `/api/stores/:storeId/printers` | List / add printer |
| PATCH/DELETE | `/api/stores/:storeId/printers/:id` | Update / deactivate |

---

## Future phases

| Phase | Focus |
|-------|-------|
| **Phase 3** | Razorpay payment integration (swap `SimulatedProvider` → `RazorpayProvider`) |
| **Phase 4** | WhatsApp order notifications (plug into `NotificationService`) |
| **Phase 5** | GST engine, multi-store owner, customer accounts |
| **Phase 6** | WebSocket live board, push notifications |

The service boundaries (`PaymentService`, `NotificationService`, `PrinterService`) are already scaffolded — integrations slot in without touching controllers.
