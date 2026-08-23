# DevDoc — Virundhu (Phase 1 + Phase 2)

> **Product name:** the platform is branded **Virundhu** ("விருந்து", the Tamil word for feast) across all user-facing surfaces (landing page, login, signup, owner console). Internal package identifiers (`@cartsas/shared`, `@cartsas/api`, `@cartsas/web`) and the `cartsas:v*` localStorage namespace are intentionally unchanged so existing code, schema names and stored sessions keep working.

> Living memory of the current implementation. Updated every session.
> Requirements source of truth: `Docs/RequirementPrompts/`.

---

## 1. Snapshot (current state)

**Project root:** `/home/workspace/CartSas`

**Phase 2 is COMPLETE. Owner self-signup is live.** The product is end-to-end usable with real data — new owners can now register from `/signup` and land on an empty (no-dummy-data) dashboard.

```
CartSas/                        ← npm workspace root
├── apps/
│   ├── api/                    ← NestJS backend (port 4000)
│   │   ├── prisma/
│   │   │   ├── schema.prisma   ← 12 models · Postgres (dev + prod)
│   │   │   ├── migrations/     ← init migration (Postgres DDL)
│   │   │   └── seed.ts         ← idempotent demo seed
│   │   └── src/
│   │       ├── modules/        ← auth, stores, categories, products, orders,
│   │       │                      payments, public, dashboard, reports,
│   │       │                      printers, settings
│   │       ├── common/         ← errors, filters, mappers, pipes
│   │       └── prisma/         ← PrismaService
│   └── web/                    ← Next.js 14 frontend (port 3000)
│       └── src/
│           ├── app/            ← routes: (owner)/, login/, order/[slug]/
│           ├── components/     ← ui primitives, owner shell, auth-guard
│           ├── features/       ← customer-ordering, orders, products, qr
│           └── lib/
│               ├── api/        ← apiFetch, adapters, auth-api, session
│               ├── domain/     ← types, state-machine, totals, csv, metrics
│               ├── hooks/      ← useCart, useDemoStore
│               ├── repositories/
│               │   ├── api/    ← ApiStoreRepo, ApiCategoryRepo, …
│               │   └── local/  ← Phase-1 localStorage repos
│               └── services/   ← order-service, payment-service
└── packages/
    └── shared/                 ← Zod schemas + DTOs (frontend + backend share)
```

**Runtime:**
- Node.js 20.x, npm 10.x
- PostgreSQL 16 (dev via Docker; prod via Neon serverless Postgres)
- Deployment blueprint: `render.yaml` (Render web + web) · see `Docs/Deployment.md`

---

## 2. Product summary

**Virundhu** — a mobile-first ordering & operations platform for Tamil street-food owners, meat shops and small kitchens. Two experiences share one codebase:

| Actor | Experience |
|-------|-----------|
| **Owner** | Signs up → Logs in → Dashboard → Live Kanban board → order management → history, reports, QR, settings |
| **Customer** | Scans QR → `/order/[slug]` → menu → cart → Simulated Pay → confirmation |

### Owner onboarding flow (new)

```
Landing/Login page
  → "Create one" link → /signup
  → Fills identity (name, email, password) + cart bootstrap (name, slug)
  → NestJS: transactionally creates User + Store (OPEN) +
             StoreUser(OWNER) + StoreSettings + OrderSequence
             (NO seed categories/products/orders)
  → JWT signed and returned → session persisted in localStorage
  → Redirect to /dashboard (empty state, ready for real data)
```

### Primary E2E flow (Phase 2 verified)

```
Customer scans QR (another device)
  → /order/anna-street-food  (menu from database)
  → adds items to cart
  → Pay Now (simulated)
  → NestJS: validates + creates Order + Customer + Payment + StatusHistory (single transaction)
  → Owner Live Board polls /api/stores/:id/orders/active every 5s
  → Owner: Accept → Preparing → Ready → Complete
  → Order history, dashboard, reports all update from DB
```

---

## 3. Tech stack

| Layer | Choice |
|-------|--------|
| Frontend framework | Next.js 14 (App Router) + React 18 + TypeScript |
| Styling | Tailwind CSS + shadcn/ui + Radix UI |
| Icons | lucide-react |
| Frontend state | TanStack Query (server state via `useCollection`) + Zustand |
| Forms | React Hook Form + Zod |
| QR generation | `qrcode` library |
| Backend framework | NestJS 10 + TypeScript |
| ORM | Prisma 5 |
| Database | SQLite (dev) / PostgreSQL (prod) |
| Validation | Zod schemas in `@cartsas/shared` (shared) + class-validator (NestJS) |
| Auth | JWT (passport-jwt + @nestjs/jwt), bcryptjs |
| API docs | Swagger/OpenAPI via @nestjs/swagger |
| Testing (api) | Jest + ts-jest |
| Testing (web) | Vitest |
| Monorepo | npm workspaces |

---

## 4. Database schema (Prisma)

All models are in `apps/api/prisma/schema.prisma`.

| Model | Key fields | Notes |
|-------|-----------|-------|
| `User` | id, email (unique), passwordHash, isActive | Auth identity |
| `Store` | id, slug (unique), name, status | Multi-tenant root |
| `StoreUser` | storeId, userId, role | Many-to-many, roles: OWNER/MANAGER/STAFF |
| `StoreSettings` | storeId (unique), showTamilNames, acceptOrders, minimumOrderValue | One per store |
| `Category` | storeId, name, displayOrder, isActive | Unique(storeId, name) |
| `Product` | storeId, categoryId, price (Decimal), isAvailable, stockQuantity | Tenant-isolated |
| `Customer` | storeId, name?, phone? | Public user, no login |
| `Order` | storeId, customerId?, orderNumber, status, totalAmount | Unique(storeId, orderNumber) |
| `OrderItem` | orderId, productId?, productName (snapshot), unitPrice (snapshot) | Historical freeze |
| `OrderStatusHistory` | orderId, fromStatus, toStatus, changedByUserId | Full audit trail |
| `Payment` | orderId, provider, status, amount | SIMULATED now; Razorpay-ready |
| `OrderSequence` | storeId (PK), nextValue | Monotonic FC-XXXX counter |
| `Printer` | storeId, name, type, isActive | Config only; no hardware |

**Key constraints:**
- Money fields: `Decimal(10,2)` — never floating point
- Soft-delete: products with order history → `isAvailable=false` not deleted
- Categories with products → blocked delete (throws `CATEGORY_HAS_PRODUCTS`)
- Historical order items snapshot productName + unitPrice at creation time

---

## 5. Backend architecture

### Module graph

```
AppModule
  ├── ConfigModule (global)
  ├── PrismaModule (global singleton)
  ├── AuthModule       → /api/auth
  ├── StoresModule     → /api/stores/:storeId
  ├── CategoriesModule → /api/stores/:storeId/categories
  ├── ProductsModule   → /api/stores/:storeId/products
  ├── OrdersModule     → /api/stores/:storeId/orders
  ├── PaymentsModule   → (internal, injected into OrdersModule)
  ├── PublicModule     → /api/public
  ├── DashboardModule  → /api/stores/:storeId/dashboard
  ├── ReportsModule    → /api/stores/:storeId/reports
  ├── PrintersModule   → /api/stores/:storeId/printers
  └── SettingsModule   → (thin placeholder, served by StoresModule)
```

### Auth guard chain

```
JwtAuthGuard → verifies Bearer token → populates req.user (AuthUser)
StoreMembershipGuard → checks StoreUser(storeId, userId) exists → blocks cross-tenant access
```

### Owner signup transaction

Endpoint: `POST /api/auth/signup` (public, no auth).
Request schema: `signupSchema` in `@cartsas/shared` — validates owner identity + store bootstrap (name + kebab-case slug).

```typescript
prisma.$transaction(async (tx) => {
  1. Ensure email is unused          → EMAIL_ALREADY_USED (409, field: "email")
  2. Ensure store slug is unused     → STORE_SLUG_TAKEN    (409, field: "storeSlug")
  3. Create User (bcrypt-hashed password, isActive=true)
  4. Create Store (status=OPEN)
  5. Create StoreUser (role=OWNER)
  6. Create StoreSettings (defaults: showTamilNames=true, acceptOrders=true, minOrder=0)
  7. Create OrderSequence(storeId, nextValue=1)
     ── NO Category / Product / Customer / Order rows are created ──
})
→ Sign JWT with same payload as login → return AuthLoginResponse
```

The response shape is **identical** to `/auth/login`, so the frontend reuses `saveSession()` and the caller lands on `/dashboard` with a real membership. The dashboard, live board, categories, and products pages all render their built-in empty states because no seed rows exist for the new tenant.

### Order creation transaction (§54)

```typescript
prisma.$transaction(async (tx) => {
  1. Verify store OPEN + acceptOrders
  2. Load products (per-tx — implicit row lock on Postgres)
  3. Validate availability, cross-store, stock
  4. Recompute totals from DB prices (never trust client)
  5. Upsert customer by phone
  6. Increment OrderSequence → orderNumber FC-XXXX
  7. Create Order + OrderItems
  8. Create OrderStatusHistory (NEW)
  9. Decrement stock; auto-mark unavailable if stock → 0
  10. Call PaymentsService.chargeAndRecord → creates Payment record
  11. Update Order.paymentStatus = PAID
})
```

### Payment provider interface

```typescript
interface PaymentProvider {
  charge(amount: number, orderId: string): Promise<PaymentResult>;
}
// Phase 2: SimulatedProvider (always PAID, instant)
// Phase 3: RazorpayProvider (slot-in — PaymentsService wires it via DI)
```

### Order state machine

Valid transitions only (enforced on backend; reflected on frontend for UX):

```
NEW → ACCEPTED → PREPARING → READY → COMPLETED
 ↓               ↓           ↓
CANCELLED     CANCELLED   CANCELLED
```

Both `canTransition` and `nextValidStatuses` live in `@cartsas/shared/transitions.ts` so frontend and backend share identical logic.

---

## 6. Frontend API layer

### Repository pattern (unchanged from Phase 1 interface)

```typescript
// Phase 1 (local mode):  UI → repos → LocalOrderRepo → localStorage
// Phase 2 (api mode):    UI → repos → ApiOrderRepo   → NestJS → Prisma
```

The interface is identical; `NEXT_PUBLIC_REPO_BACKEND=api` selects the backend at build time.

### Key files

| File | Purpose |
|------|---------|
| `lib/api/client.ts` | `apiFetch<T>()` — attaches Bearer token, deserializes JSON, auto-logout on 401 |
| `lib/api/adapters.ts` | DTO → frontend domain converters (isolates shape differences) |
| `lib/api/auth-api.ts` | `apiLogin`, `apiSignup`, `apiLogout`, `apiCurrentSession` |
| `lib/api/session.ts` | JWT session persisted in `localStorage` key `cartsas:v2:auth` |
| `lib/api/dashboard-api.ts` | `fetchDashboardMetrics`, `fetchReportsSummary` (API-side aggregation) |
| `lib/repositories/api/` | `ApiStoreRepo`, `ApiCategoryRepo`, `ApiProductRepo`, `ApiOrderRepo` |
| `lib/repositories/factory.ts` | `getRepos()` — backend selector + singleton cache |
| `lib/repositories/repo-provider.tsx` | `RepoProvider`, `useRepos()`, `useCollection()` — React context + polling |
| `components/auth/auth-guard.tsx` | Redirects to `/login` if no session (API mode only); listens to `cartsas:auth` and `storage` events for reactive sign-out |

### `useCollection` hook

The central data-fetching primitive. Used by every page:

```typescript
const { data, loading, error, refresh } = useCollection(
  "orders",                          // cache key (CollectionName)
  async (repos) => repos.orders.list(storeId, filter),
  { poll: true, pollMs: 5_000 }      // 5s polling for live board
);
```

- **Local mode**: subscribes to the `EventBus` for same-tab writes + `storage` event for cross-tab.
- **API mode**: opts into polling; manual refresh after mutations.

---

## 7. Implementation progress

### Phase 1 (completed previous session)

| # | Step | Status |
|---|------|--------|
| 1–18 | All Phase 1 steps | ✅ Done (see AcceptanceTest.md) |

### Phase 2 (this session)

| # | Milestone | Status | Notes |
|---|-----------|--------|-------|
| P2-1 | Monorepo restructure | ✅ | `apps/`, `packages/`, npm workspaces |
| P2-2 | `packages/shared` — Zod schemas, DTOs, transitions | ✅ | Source of truth for both apps |
| P2-3 | Prisma schema — 12 models, migrations, seed | ✅ | SQLite dev; Postgres-compatible |
| P2-4 | NestJS scaffold — main.ts, app.module, Swagger | ✅ | Port 4000, `/api/docs` |
| P2-5 | Common infra — ApiException, GlobalFilter, ZodPipe, Decimal mappers | ✅ | Consistent error envelope |
| P2-6 | Auth module — login, JWT strategy, JwtAuthGuard, StoreMembershipGuard | ✅ | Tenant isolation enforced |
| P2-7 | Stores + Categories + Products modules (CRUD) | ✅ | Tenant-safe; soft-delete strategy |
| P2-8 | Orders module — createFromPublic (transaction), state machine, status history | ✅ | Concurrency-safe stock; server-authoritative totals |
| P2-9 | Payments module — SimulatedProvider + chargeAndRecord | ✅ | Razorpay-ready interface |
| P2-10 | Public module — unauthenticated customer endpoints | ✅ | No auth; minimal PII exposure |
| P2-11 | Dashboard module — DB-aggregated metrics | ✅ | Counts + revenue from Prisma |
| P2-12 | Reports module — summary + CSV export | ✅ | Date range filtering |
| P2-13 | Printers module — CRUD | ✅ | Config only; no hardware |
| P2-14 | Frontend API client + adapters | ✅ | apiFetch, DTO→domain converters |
| P2-15 | `api/*` repositories — ApiStoreRepo, ApiCategoryRepo, ApiProductRepo, ApiOrderRepo | ✅ | Drop-in for `local/*` |
| P2-16 | AuthGuard + login page + session management | ✅ | Redirects, JWT in localStorage |
| P2-17 | Dashboard page — API metrics endpoint (not client-computed) | ✅ | Fetches `/dashboard`; falls back to local computation in demo mode |
| P2-18 | Reports page — API summary endpoint | ✅ | Server-side aggregation; CSV client-side |
| P2-19 | Live board — 5s polling, transition actions | ✅ | useCollection({ poll: true, pollMs: 5000 }) |
| P2-20 | Customer flow — CartSheet → ApiOrderRepo.checkout → API | ✅ | Public endpoint, no auth |
| P2-21 | Success page — public order lookup by orderNumber | ✅ | Cross-device viewable |
| P2-22 | Settings page → API (store + settings PATCH) | ✅ | Persists across devices |
| P2-23 | Owner topbar logout | ✅ | Clears session, redirects to /login |
| P2-24 | Backend tests (Jest) | ✅ | 36 tests across 6 suites |
| P2-25 | Web tests (Vitest) | ✅ | 54 tests across 6 suites |
| P2-26 | TypeScript clean — both apps | ✅ | `tsc --noEmit` passes both |
| P2-27 | README.md — Phase 2 setup & API reference | ✅ | Full local-setup guide |
| P2-28 | DevDoc.md — Phase 2 update | ✅ | This file |
| P2-29 | Owner self-signup — schema + service + controller + tests | ✅ | Transactional; no dummy data |
| P2-30 | `/signup` page + login-page link | ✅ | Slug auto-suggest, field-level errors |
| P2-31 | Sign-out hard-nav + reactive AuthGuard | ✅ | `window.location.assign("/login")` tears down owner-layout state; guard listens to `cartsas:auth`/`storage` |
| P2-32 | Rebrand user-facing UI → **Virundhu** | ✅ | Landing, login, signup, sidebar, drawer, topbar fallback, metadata |
| P2-33 | Marketing landing page redesign | ✅ | Dark hero + mock Shop Owner Panel preview inspired by Kari Kadai; removed Phase-1 badge & Customer Menu card |
| P2-34 | Postgres-only schema + `/api/health` + `render.yaml` + `Docs/Deployment.md` | ✅ | Provider switched from SQLite → Postgres; init migration rewritten in Postgres DDL; health module for Render probes; blueprint provisions API + web with Neon as the DB |

**Total tests: 98 (40 API + 58 web)**

### Sign-out flow (P2-31 detail)

`OwnerTopBar → apiLogout()` clears `localStorage["cartsas:v2:auth"]` and
dispatches the `cartsas:auth` event, then calls
`window.location.assign("/login")` — a **hard** navigation. This is required
because `router.replace("/login")` alone kept the `(owner)/layout.tsx` React
tree mounted; the layout stayed on `/dashboard` but every `useCollection`
call now hit an unauthenticated API and returned zeros. The hard-nav tears
down the entire client tree so the login page renders from a clean slate.

Belt-and-braces: `AuthGuard` now also subscribes to `cartsas:auth`
(same-tab) and `storage` (cross-tab) events, so any code path that clears
the session — 401 auto-logout in `apiFetch`, another tab logging out —
still kicks the user to `/login` immediately.

---

## 8. Key decisions & conventions

### General

- **Monorepo:** npm workspaces — `apps/api`, `apps/web`, `packages/shared`.
- **Shared package:** `@cartsas/shared` — Zod schemas + DTOs + transitions. Never duplicated.
- **Money:** `Decimal(10,2)` in DB; `decimalToNumber()` converts at the API boundary to `number`.
- **IDs:** UUID everywhere. Order numbers are human-friendly `FC-XXXX` (monotonic per store).
- **Soft delete:** Products with order history → `isAvailable=false`. Categories with products → blocked.

### Backend

- **Single transaction for order creation:** `prisma.$transaction` covers customer upsert, order, items, history, stock decrement, and payment.
- **No N+1:** Dashboard uses `Promise.all` over separate aggregate queries. Live board returns `include: { items, customer }` in one query.
- **Tenant isolation:** Every owner endpoint extracts `storeId` from the URL param; `StoreMembershipGuard` verifies the JWT user is a member of that store.
- **Public API:** No auth. Returns only `PublicStoreDTO` (settings embedded inline, no internal IDs).

### Frontend

- **Repository seam preserved:** All UI code calls `useRepos()` → never `fetch()` directly.
- **Polling over WebSockets (Phase 2):** `useCollection(..., { poll: true, pollMs: 5000 })` — replaceable later with SSE/WebSocket without touching UI.
- **Adapters isolate DTO shape:** `lib/api/adapters.ts` converts `OrderDTO` → `Order` (frontend domain). UI never knows the API shape changed.
- **API mode vs local mode:** Controlled by `NEXT_PUBLIC_REPO_BACKEND`. `local` keeps Phase-1 demo alive; `api` is the production default.

---

## 9. API error codes

All errors return:
```json
{ "statusCode": 4xx, "code": "SNAKE_CASE_CODE", "message": "Human description" }
```

| Code | Status | When |
|------|--------|------|
| `NOT_FOUND` | 404 | Resource doesn't exist |
| `INVALID_CREDENTIALS` | 401 | Wrong email/password |
| `EMAIL_ALREADY_USED` | 409 | Signup with an email that already has an account (details.field=`email`) |
| `STORE_SLUG_TAKEN` | 409 | Signup with a store slug already in use (details.field=`storeSlug`) |
| `UNAUTHORIZED` | 401 | Missing/expired token |
| `FORBIDDEN` | 403 | User is not a member of the store |
| `STORE_CLOSED` | 409 | Store.status = CLOSED at order time |
| `STORE_NOT_ACCEPTING` | 409 | Settings.acceptOrders = false |
| `EMPTY_CART` | 400 | Order submitted with zero items |
| `PRODUCT_UNAVAILABLE` | 409 | Product.isAvailable = false |
| `PRODUCT_OUT_OF_STOCK` | 409 | stockQuantity < requested quantity |
| `CROSS_STORE_PRODUCT` | 400 | Product belongs to a different store |
| `BELOW_MIN_ORDER` | 400 | Total < store minimumOrderValue |
| `INVALID_TRANSITION` | 409 | Invalid order status change |
| `CATEGORY_HAS_PRODUCTS` | 409 | Attempt to delete category with products |
| `INTERNAL_ERROR` | 500 | Unhandled server error |

---

## 10. Seed data

`apps/api/prisma/seed.ts` — idempotent (safe to re-run).

| Entity | What's created |
|--------|---------------|
| User | `owner@anna.test` / `owner123` (bcrypt hashed) |
| Store | `anna-street-food` — "Anna Street Food", status OPEN |
| StoreUser | owner → OWNER role |
| StoreSettings | showTamilNames=true, minOrder=₹0, prepTime=15min |
| Categories | Chicken, Snacks, Rice & Meals, Drinks, Egg (5 total) |
| Products | 10 products with Tamil names and prices |
| OrderSequence | nextValue=1 (FC-1001 on first order) |

---

## 11. Running locally

```bash
# Install all workspaces
cd CartSas && npm install

# Configure env
cp apps/api/.env.example apps/api/.env       # Edit JWT_SECRET
cp apps/web/.env.example apps/web/.env.local  # Edit NEXT_PUBLIC_API_URL if needed

# Database — Postgres 16 required (SQLite no longer supported)
# Fastest path (Docker):
docker run -d --name virundhu-pg -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=virundhu -p 5432:5432 -v virundhu-pg-data:/var/lib/postgresql/data postgres:16

npm run db:migrate   # applies Postgres migrations to the local DB
npm run db:seed      # seeds Anna Street Food demo data

# Start everything
npm run dev          # API on :4000 | Web on :3000
```

**Owner signup (new tenant, empty account):** http://localhost:3000/signup
**Owner login (seeded demo):** `owner@anna.test` / `owner123`
**Customer page:** http://localhost:3000/order/anna-street-food
**Swagger docs:** http://localhost:4000/api/docs
**Health check:** http://localhost:4000/api/health

---

## 11a. Hosting

Production is a **Render Blueprint** (`render.yaml`) that provisions two web
services (`virundhu-api`, `virundhu-web`) both in Singapore, wired to a
**Neon** serverless Postgres database. See **`Docs/Deployment.md`** for the
full walk-through — including the file-level changes already applied
(Postgres provider, health endpoints, `start:prod` with `migrate deploy`),
the Neon setup, Render environment variables, verification steps, backups,
and custom-domain configuration.

---

## 12. Test coverage summary

### Backend (Jest) — 40 tests, 6 suites

| Suite | Tests | What's covered |
|-------|-------|----------------|
| `order-status.service.spec.ts` | 6 | State machine transitions (valid + invalid) |
| `orders.service.spec.ts` | 6 | Order creation: happy path, empty cart, store closed, cross-store product, unavailable product, insufficient stock, below-minimum |
| `categories.service.spec.ts` | 6 | List, create, update 404, remove 404, blocked delete, clean delete |
| `products.service.spec.ts` | 8 | List, create with tenant-safe category, cross-store reject, 404, soft/hard delete, availability, Decimal→number mapping |
| `auth.service.spec.ts` | 9 | **Login** (5): happy path, wrong password, unknown user, inactive user, no passwordHash leak. **Signup** (4): creates full tenant with zero dummy data, rejects duplicate email, rejects duplicate slug, hashes password |
| `public.service.spec.ts` | 5 | Store by slug, 404 slug, products (available only, include unavailable), categories |

### Frontend (Vitest) — 54 tests, 6 suites

| Suite | Tests | What's covered |
|-------|-------|----------------|
| `order-number.test.ts` | 3 | FC-XXXX format, sequential numbering |
| `totals.test.ts` | 6 | Subtotal, total, zero cart, rounding |
| `order-status.test.ts` | 9 | All valid transitions, all invalid transitions |
| `order-service.test.ts` | 13 | Full order service: validation codes, payment failure, success |
| `dashboard-metrics.test.ts` | 9 | Today metrics, product metrics, top items |
| `csv.test.ts` | 14 | RFC 4180 escaping, BOM, multi-item rows, edge cases |

---

## 13. Open items / next phases

### Phase 3 — Razorpay integration

1. Create `RazorpayProvider implements PaymentProvider` in `apps/api/src/modules/payments/providers/`.
2. Wire via `PaymentsModule` (replace `SimulatedProvider` in DI or add a config flag).
3. Add Razorpay webhook endpoint in `PublicModule` (no auth, signature verification).
4. Update `Order.paymentStatus` from the webhook.
5. No OrdersController changes needed.

### Phase 4 — WhatsApp notifications

1. Create `WhatsAppNotificationProvider` in a new `NotificationModule`.
2. Inject into `OrdersService.createFromPublic` (after order creation) and `OrderStatusService.transition` (on status change).
3. Use Twilio or Meta Cloud API.

### Phase 5 — Multi-store owner, customer accounts

- The schema already supports `StoreUser` many-to-many — just expose a store-picker in the owner UI.
- Customer accounts: add `userId` FK to `Customer` table + login flow.

### Phase 6 — WebSocket live board

Replace the 5s polling in `useCollection` with a NestJS Gateway (Socket.IO or native WS):
1. Server emits `order:created`, `order:updated` events.
2. Client subscribes in `RepoProvider.useEffect`.
3. `useCollection` reacts to socket events instead of `setInterval`.

---

## 14. Version control & `.gitignore`

### What is committed (source only)
| Path | Status |
|------|--------|
| `apps/api/src/**` | ✅ tracked |
| `apps/web/src/**` | ✅ tracked |
| `packages/shared/src/**` | ✅ tracked |
| `apps/api/prisma/schema.prisma` | ✅ tracked |
| `apps/api/prisma/migrations/**` | ✅ tracked (migration SQL is source) |
| `apps/api/prisma/seed.ts` | ✅ tracked |
| `apps/api/.env.example` | ✅ tracked (safe template) |
| `apps/web/.env.example` | ✅ tracked (safe template) |
| `package.json` / `package-lock.json` | ✅ tracked |
| `README.md`, `Docs/**` | ✅ tracked |

### What is **never** committed
| Path | Reason |
|------|--------|
| `**/node_modules/` | Generated — `npm install` re-creates it |
| `apps/api/dist/` | Generated — `npm run build` re-creates it |
| `apps/web/.next/` | Generated — Next.js build artefact |
| `packages/shared/dist/` | Generated — `tsc` re-creates it |
| `apps/api/prisma/dev.db` | Local SQLite — `npm run db:migrate` re-creates it |
| `apps/api/.env` | Contains JWT secret — **never share** |
| `apps/web/.env.local` | Contains API base URL — local override only |
| `*.tsbuildinfo` | Incremental TS cache |
| `*.log`, `coverage/` | Noise |

### `.gitignore` highlights
```
**/node_modules/          ← catches root + all workspace node_modules
apps/api/dist/            ← NestJS compiled output
apps/web/.next/           ← Next.js build cache
packages/shared/dist/
*.db  *.sqlite            ← SQLite dev databases
.env  .env.local  .env.*.local   ← real secrets
*.tsbuildinfo             ← TS incremental cache
!**/.env.example          ← explicitly KEEP .env.example files
!apps/api/prisma/migrations/**/migration.sql  ← KEEP migration SQL
```

### First-time setup after `git clone`
```bash
npm install              # restore all node_modules from package-lock.json
cp apps/api/.env.example apps/api/.env   # fill in JWT_SECRET
cp apps/web/.env.example apps/web/.env.local
npm run db:migrate       # apply Prisma migrations → creates dev.db
npm run db:seed          # seed demo data (Anna Street Food)
npm run dev              # start API :4000 + Web :3000
```

---

## 15. How to resume next session

1. Read this file top-to-bottom.
2. Run `npm test` from the repo root — expect 94 tests passing (40 API + 54 web).
3. Run `npm run db:seed` if the dev.db is missing or stale.
4. Start with `npm run dev`.
5. Pick the next phase from §13.
