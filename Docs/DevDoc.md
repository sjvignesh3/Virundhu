# DevDoc — Food Cart SaaS (Phase 1)

> Living memory of the current implementation. Updated as work progresses.
> Requirements source of truth: `Docs/Requirements`.

---

## 1. Snapshot (current session)

**Project root:** `/home/workspace/CartSas`

**Workspace state at start of this session:**

```
CartSas/
├── .git/               (empty repo)
├── .zcode/             (IDE config, all empty)
└── Docs/
    ├── Requirements                  (full Phase 1 spec — 27 KB)
    └── RefScreenshots/               (8 PNGs — legacy meat-shop UI, reference only)
```

**No application code exists yet.** No `package.json`, no `src/`, nothing scaffolded.

**Runtime:**
- Platform: Linux 6.1.112
- Node.js: being installed via NodeSource 20.x (was missing at session start)
- Package manager target: `npm` (bundled with Node 20)
- `sudo` available (passwordless)

---

## 2. Product summary

Building a **mobile-first Food Cart ordering & operations SaaS** — Phase 1 (frontend-first MVP).

Two experiences share one codebase:

- **Owner / Operator** (dashboard, products, categories, live orders, order history, reports, QR, printers, settings)
- **Customer** (`/order/[storeSlug]` — mobile-first digital menu → cart → simulated checkout → order confirmation)

Core end-to-end flow that MUST work in Phase 1:

```
QR → /order/anna-street-food → menu → cart → Pay Now (simulated)
   → order created (status NEW)
   → Owner Live Board: NEW → ACCEPTED → PREPARING → READY → COMPLETED
   → Order History + Dashboard metrics updated
```

**Explicitly out of scope in Phase 1:** Razorpay, WhatsApp, real auth, PostgreSQL, WebSockets, notifications, printer hardware.

---

## 3. Tech stack (locked)

| Layer            | Choice                                   |
| ---------------- | ---------------------------------------- |
| Framework        | Next.js 14 (App Router) + React 18 + TS  |
| Styling          | Tailwind CSS                             |
| UI primitives    | shadcn/ui + Radix UI                     |
| Icons            | lucide-react                             |
| Client state     | Zustand                                  |
| Server state     | TanStack Query                           |
| Forms            | React Hook Form                          |
| Validation       | Zod                                      |
| QR generation    | `qrcode.react` (client) — TBD            |
| Persistence P1   | Repository pattern → localStorage (SSR-safe wrapper) |

---

## 4. Target architecture

```
src/
  app/                          Next.js routes
    (owner)/
      dashboard/
      products/
      categories/
      orders/                  (history)
      live-orders/
      reports/
      printers/
      settings/
      layout.tsx               (sidebar shell)
    order/[storeSlug]/         Customer ordering page
    layout.tsx
    globals.css
  components/
    ui/                        shadcn primitives
    layout/                    Sidebar, TopBar, MobileNav
    common/                    EmptyState, LoadingSkeleton, ErrorState
  features/
    customer-ordering/         Menu, ProductCard, StickyCartBar, CartSheet, Confirmation
    products/                  ProductList, ProductForm
    categories/                CategoryList, CategoryForm
    orders/                    OrderCard, OrderDetails, OrderHistoryTable
    live-orders/               KanbanBoard, KanbanColumn, LiveOrderCard
    dashboard/                 MetricCard, TodayStats
    reports/                   ReportFilters, ReportTable, ExportCsv
    qr/                        StoreQRCode, QRModal, PrintPoster
    settings/                  BusinessForm, OrderingForm, MenuForm, BrandingForm
  domain/
    product/                   types + calc helpers
    category/                  types
    order/                     types + state machine (canTransition, computeTotals)
    store/                     types
    payment/                   simulated payment abstraction
  repositories/
    interfaces/                *Repository.ts
    local/                     localStorage impls + seed
    index.ts                   DI wiring
  services/                    productService, orderService, storeService
  stores/                      zustand: cartStore, uiStore
  hooks/                       useProducts, useOrders, useCart, ...
  lib/                         cn, formatCurrency, id, csv, storage
  i18n/                        en.ts, ta.ts, useT hook
  types/                       shared cross-cutting types
```

**Golden rule:** UI → hooks → services → repositories → (Phase 1) local. Never bypass.

---

## 5. Domain models (v1)

```ts
type OrderStatus = 'NEW' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED';
type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED';
type PaymentMethod = 'SIMULATED' | 'CASH' | 'UPI';
type Unit = 'plate' | 'piece' | 'cup' | 'glass' | 'bottle' | 'kg' | 'g';

interface Store   { id; slug; name; tamilName?; description?; phone?; address?; status: 'OPEN'|'CLOSED';
                    minOrderValue?; prepTimeMinutes?; language: 'en'|'ta';
                    showTamilNames: boolean; showUnavailable: boolean; logo?; accent?; }
interface Category{ id; storeId; name; tamilName?; sortOrder; }
interface Product { id; storeId; categoryId; name; tamilName?; description?; tamilDescription?;
                    price; unit: Unit; image?; available: boolean; lowStockThreshold?; stock?; }
interface OrderItem { productId; name; tamilName?; unit; unitPrice; quantity; lineTotal; }
interface Customer { name?; phone?; note?; }
interface Order   { id; orderNumber; storeId; customer: Customer; items: OrderItem[];
                    subtotal; total; paymentMethod: PaymentMethod; paymentStatus: PaymentStatus;
                    status: OrderStatus; createdAt; updatedAt; completedAt?; }
```

**Pure functions (domain layer, no React):**
- `computeOrderTotals(items)` → `{ subtotal, total }`
- `canTransition(current, next)` → boolean
- `nextValidStatuses(current)` → `OrderStatus[]`
- `generateOrderNumber(seq)` → `FC-1024`

---

## 6. Seed data — "Anna Street Food"

Slug: `anna-street-food`. Categories: Chicken, Snacks, Rice & Meals, Drinks, Egg.

| Product                | Tamil                          | Price | Unit  | Category      |
| ---------------------- | ------------------------------ | ----- | ----- | ------------- |
| Chicken Kothu Parotta  | சிக்கன் கொத்து பரோட்டா        | 120   | plate | Chicken       |
| Egg Kothu Parotta      | முட்டை கொத்து பரோட்டா          | 90    | plate | Egg           |
| Chicken 65             | சிக்கன் 65                     | 140   | plate | Chicken       |
| Chicken Rice           | சிக்கன் சாதம்                   | 110   | plate | Rice & Meals  |
| Egg Rice               | முட்டை சாதம்                    | 80    | plate | Rice & Meals  |
| Parotta                | பரோட்டா                        | 20    | piece | Snacks        |
| Omelette               | ஆம்லெட்                        | 40    | plate | Egg           |
| Lemon Soda             | லெமன் சோடா                     | 40    | glass | Drinks        |
| Fresh Lime             | எலுமிச்சை ஜூஸ்                  | 30    | glass | Drinks        |
| Tea                    | டீ                             | 15    | cup   | Drinks        |

---

## 7. Implementation plan & progress

Following requirements §33. Progress log lives here.

| #  | Step                                          | Status  | Notes |
| -- | --------------------------------------------- | ------- | ----- |
| 0  | Install Node.js + tooling                     | ✅      | Node 20.20.2 + npm 10.8.2 via nvm (user-space, no sudo). |
| 1  | Scaffold Next.js + Tailwind + shadcn setup    | ✅      | Next 14.2 App Router, TS, Tailwind, ESLint, `src/`, `@/*` alias. Placeholder home renders at `/`. |
| 2  | Design system tokens + Tailwind theme         | ✅      | HSL CSS vars (light+dark), warm accent `#f97316` family, Inter + Noto Sans Tamil via `next/font/google`, container + radius tokens, shadcn-compatible palette. |
| 3  | Shared UI primitives (`Button`, `Card`, `Input`, `Badge`, `cn`, `formatCurrency`) | ✅      | shadcn-compatible components in `src/components/ui/`, `cn()` + `formatCurrency()` in `src/lib/utils.ts`. Home page refactored to consume them — end-to-end render verified. |
| 4  | Owner app shell (sidebar + mobile nav)        | ✅      | Route group `(owner)` with collapsible desktop sidebar, mobile drawer + bottom tab bar. All 9 owner routes scaffolded with per-route `loading.tsx`, top-of-page `RouteProgress` bar, idle-time prefetch of primary routes, and hover-intent prefetch on secondary nav. `useSelectedLayoutSegment`-driven active state avoids nav re-renders on in-page state changes. Dark-mode toggle via `next-themes`. |
| 5  | Domain models + repository interfaces         | ✅      | `src/lib/domain/` — `types.ts` (Store/Category/Product/Order + drafts), `order-status.ts` (state-machine transitions, `canTransition`, `nextValidStatuses`), `totals.ts` (`computeOrderTotals`, `buildOrderItem` w/ price snapshot), `order-number.ts` (`FC-1024` format, seq starts at 1001), `ids.ts` (`newId()` via `crypto.randomUUID` w/ fallback). `src/lib/repositories/` — async `StoreRepo`/`CategoryRepo`/`ProductRepo`/`OrderRepo` interfaces designed as a storage-agnostic seam. |
| 6  | localStorage repositories + seed              | ✅      | `src/lib/storage/` (SSR-safe JSON wrapper, `cartsas:v1:*` keys, tiny pub/sub with `storage`-event cross-tab sync). `src/lib/repositories/local/` — four `Local*Repo` classes; `LocalOrderRepo.transition` enforces `canTransition` and throws `InvalidTransitionError`. `src/lib/seed/anna-street-food.ts` — idempotent seed guarded by `seeded` flag; 1 store, 5 categories, 10 Tamil products. `RepoProvider` mounted in owner + customer layouts; `useRepos()` + `useCollection()` give reactive reads. |
| 7  | Products + Categories screens                 | ✅      | shadcn primitives added: `Dialog`, `Sheet`, `Switch`, `Select`, `Label`, `Textarea`, `EmptyState`, `ConfirmDialog`. Categories page: list w/ up/down reorder, create/edit dialog, guarded delete (blocks if products reference it). Products page: filterable grid (search + category), inline availability switch, create/edit dialog w/ price+unit+category+description+Tamil name, destructive delete confirm. Both use `useCollection` so writes reflect instantly + across tabs. |
| 8  | Customer ordering page `/order/[slug]`        | ✅      | `src/app/order/[storeSlug]/` — hero header, sticky category chip nav, product cards with inline +/- controls, honors `store.showTamilNames` and `store.showUnavailable`. Cart persists in `sessionStorage` scoped by slug (`useCart` hook) so refresh keeps cart, closing tab discards it. Sticky cart bar shows count + subtotal. |
| 9  | Cart + simulated checkout + confirmation      | ✅      | `CartSheet` (right-side Radix sheet): line items with per-line +/- and remove, name/phone/note fields, live subtotal/total, min-order guard, store-closed guard. `paymentService.charge()` (SimulatedPaymentService) returns PAID after 400 ms. On success, `OrderRepo.create` snapshots items via `buildOrderItem`, assigns `FC-1001+` number, then routes to `/order/[slug]/success/[orderId]` which shows the confirmation with order number, items, totals, and status badge. |
| 10 | Order state machine + createOrder service     | ✅      | `src/lib/domain/order-status.ts` — allowed-transition table + `canTransition`/`nextValidStatuses`/`isTerminal`. `src/lib/services/order-service.ts` — `createOrder({ storeId, customer, lines }, deps)` validates store/open/min-order/products, calls `PaymentService.charge`, then persists via `OrderRepo.create` (repo assigns id, orderNumber `FC-1001+`, timestamps). Typed `OrderValidationError` codes: STORE_NOT_FOUND, STORE_CLOSED, EMPTY_CART, PRODUCT_NOT_FOUND, PRODUCT_UNAVAILABLE, CROSS_STORE_PRODUCT, BELOW_MIN_ORDER, PAYMENT_FAILED. Repo enforces transitions and throws `InvalidTransitionError`; sets `completedAt` on entry to COMPLETED. 13-case Vitest suite in `order-service.test.ts` covers every branch. |
| 11 | Live Order Board (Kanban)                     | ✅      | `src/app/(owner)/orders/live/page.tsx` — 4-column responsive Kanban (NEW → ACCEPTED → PREPARING → READY) driven by `useCollection('orders', …)`, cross-tab reactive. Live "N minutes ago" via `useTicker(30s)` + `formatElapsed`. Tap a card → `OrderDetailSheet` (right sheet) surfaces only valid next statuses computed from `nextValidStatuses`; each action goes through `repos.orders.transition` which re-validates via `canTransition`. Toasts on success/failure via `sonner`. Cancel action guarded by `ConfirmDialog`. Empty-state when queue is clear. |
| 12 | Order History                                 | ✅      | `src/app/(owner)/orders/history/page.tsx` — desktop table + mobile list showing COMPLETED + CANCELLED orders. Search across order number / customer name / phone; date range toggles (Today / 7d / 30d / All) map to `OrderRepo.list({ from })`. Reuses `OrderStatusBadge` and `OrderDetailSheet` (read-only for terminal states). Header shows filtered order count + total revenue badge. |
| 13 | Dashboard metrics wired to real data          | ✅      | `src/lib/domain/dashboard-metrics.ts` — pure aggregators `computeTodayMetrics` (ordersToday / completedToday / activeOrders / revenueToday), `computeProductMetrics` (total/available/unavailable/lowStock/outOfStock), `computeTopItems` (aggregate COMPLETED order items → sort by qty). 9-case Vitest suite covers empty inputs, timezone-safe day boundary, active-vs-completed classification, low/out-of-stock rules, limit. Dashboard page rewritten as a client component that calls `useCollection('orders', …)` + `useCollection('products', …)`, memoizes metrics, and renders TODAY + MENU stat strips, Live Orders preview (uses `OrderStatusBadge` + `formatElapsed`), and Top Items sparkbars. Header greeting uses the actual store name; QR / Live Orders / Add Product quick actions in the header. |
| 14 | Reports + CSV export                          | ⏳      | Reports summary + top items already live at `/reports` (revenue / orders / avg ticket / cancel rate over Today/7d/30d/All). CSV export not yet wired. |
| 15 | QR code modal + print poster                  | ⏳      | `/qr` route already generates a scannable PNG QR from `window.location.origin + /order/{slug}` via `qrcode` library, plus Copy Link / Download PNG / Open. Print-poster route still to build. |
| 16 | Settings + Printers placeholder               | ☐       |       |
| 17 | Responsive / a11y / empty-loading-error pass  | ☐       |       |
| 18 | Acceptance test walkthrough (§32)             | ☐       |       |

**Legend:** ☐ not started · ⏳ in progress · ✅ done · ⚠️ blocked

---

## 8. Key decisions & conventions

- **App Router route groups**: `(owner)` for owner surfaces so URLs are clean (`/dashboard`, not `/owner/dashboard`). Customer route stays top-level: `/order/[storeSlug]`.
- **Persistence**: Single `localStorage` namespace `cartsas.v1.*`. All writes go through `lib/storage.ts` with SSR-safe guards + JSON codec + version key for future migrations.
- **IDs**: `crypto.randomUUID()` for entities; order numbers use a monotonically increasing counter stored per-store (`FC-1000+`).
- **Cross-tab sync**: subscribe to `storage` events so an order created in a customer tab appears in the owner tab without hard reload.
- **Currency**: `₹` via `Intl.NumberFormat('en-IN', { style:'currency', currency:'INR', maximumFractionDigits:0 })`.
- **i18n**: minimal handcrafted dictionary + `useT()` hook now; can swap to `next-intl` later.
- **QR**: `qrcode.react` renders SVG; download converts SVG → PNG via canvas; print poster is a plain print-stylesheet route.
- **Payment abstraction**: `PaymentService.charge(order)` returns `{ status, method }`. Phase 1 impl returns `{ status:'PAID', method:'SIMULATED' }` synchronously.

---

## 9. Open questions / to revisit

- Multi-store support: seed exactly one store in Phase 1; keep `storeId` on every entity so multi-tenant lands without schema change.
- Auth: not in Phase 1 — but keep an `AuthContext` stub returning the demo owner so guards exist for Phase 2.
- Image handling: use `next/image` with local `/public` placeholder + gradient fallback tile.
- **Security debt**: `npm audit` reports 5 high CVEs on Next 14.2.33 (DoS in Image Optimizer / Server Components / rewrites — all self-host-only) and transitive `postcss` / `glob` in devDeps. Non-blocking for local Phase 1 MVP; **must bump to Next 14.2 latest patch or Next 15 with a compat sweep before any production deploy**. Rejected `npm audit fix --force` because it moves to Next 15 major.

---

## 10. Running the app locally

**Prerequisites**
- Node.js 20.x (managed via `nvm` — no sudo required).
- `npm` 10.x (bundled with Node 20).

**One-time setup**

```bash
cd /home/workspace/CartSas
nvm use 20            # ensure Node 20 is active in this shell
npm install           # installs all deps into ./node_modules
```

**Start the dev web server**

```bash
cd /home/workspace/CartSas
npm run dev
```

- Serves on http://localhost:3000 (Next.js 14, hot reload enabled).
- Owner surfaces:
  - Dashboard: http://localhost:3000/dashboard
  - Products: http://localhost:3000/products
  - Categories: http://localhost:3000/categories
  - Live Orders: http://localhost:3000/orders/live
  - Order History: http://localhost:3000/orders/history
  - Reports: http://localhost:3000/reports
  - QR Code: http://localhost:3000/qr
  - Printers: http://localhost:3000/printers
  - Settings: http://localhost:3000/settings
- Customer menu (Anna Street Food seed): http://localhost:3000/order/anna-street-food

**Verify the end-to-end flow** (matches Requirements §3):

1. Open `/order/anna-street-food` in one tab (or scan the QR from `/qr` on a phone on the same LAN).
2. Add items → open cart → **Pay Now** → confirmation with `FC-1001+` number.
3. Open `/orders/live` in another tab — the new order appears under **NEW** (cross-tab `storage` events keep it live).
4. Advance NEW → ACCEPTED → PREPARING → READY → COMPLETED via the detail sheet.
5. `/orders/history` shows the completed order; `/dashboard` `Today` metrics reflect the revenue + counts.

**Other useful scripts**

| Command                 | Purpose                                              |
| ----------------------- | ---------------------------------------------------- |
| `npm run dev`           | Start Next.js dev server on `:3000`.                 |
| `npm run build`         | Production build. Verifies types + static generation. |
| `npm run start`         | Serve the production build (requires `build` first). |
| `npm run lint`          | ESLint (next-lint) on the whole workspace.           |
| `npm test`              | Run the Vitest suite once (currently 40 tests).      |
| `npm run test:watch`    | Vitest in watch mode while iterating on domain code. |

**Resetting the demo data**
The app persists everything in `localStorage` under `cartsas:v1:*` keys.
To wipe orders and re-seed the demo store, open DevTools → Application → Local Storage → clear the origin and reload; `seedIfNeeded` will re-populate the store + categories + products (existing orders are cleared but the counter for `FC-XXXX` resets too).

**Port already in use?**

```bash
# 1) find the offender
lsof -i :3000
# 2) kill any stuck Next dev process
pkill -f "next dev"
# 3) or start on another port
PORT=3001 npm run dev
```

---

## 11. How to resume next session

1. Read this file top-to-bottom.
2. Check the progress table in §7 — pick up at the first non-✅ row.
3. Verify workspace layout still matches §4; if drift, reconcile before coding.
4. Run `npm run dev` from `/home/workspace/CartSas` (see §10 for the full checklist).
