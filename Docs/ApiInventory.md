# API Inventory — Legacy NestJS → Supabase Mapping

> **Source of truth for the v2 rewrite.** Every endpoint in the legacy `apps/api` NestJS backend is catalogued here with its exact REST shape, auth requirement, and the corresponding Supabase primitive (PostgREST endpoint, RPC, view, or Edge Function) that will replace it. Client-side contracts (`packages/shared` Zod schemas) are **frozen** — the new backend must round-trip byte-identical JSON.

Status legend: 🟢 covered by PostgREST · 🟣 covered by RPC · 🔵 covered by view · 🟠 covered by Edge Function · ⚪ deprecated

---

## 1. Auth (`/auth`)

| Legacy Endpoint | Method | Guard | Body / Query | Response Shape | v2 Replacement | Status |
|---|---|---|---|---|---|---|
| `/auth/signup` | POST | public | `SignupRequest` (email, password, storeName, ownerName?) | `{ token, user, store }` | Edge Function `auth-signup` → creates `auth.users` + `public.stores` + `public.store_members` in one transaction, returns Supabase session | 🟠 |
| `/auth/login` | POST | public | `{ email, password }` | `{ token, user, store }` | `supabase.auth.signInWithPassword()` client-side; adapter reshapes `{ session, user }` to legacy shape (`app_metadata.store_ids[0]` → `store`) | 🟢 native |
| `/auth/me` | GET | JWT | — | `{ user, store }` | PostgREST `GET /rest/v1/store_members?select=*,stores(*)&user_id=eq.<uid>` + RLS | 🟢 |

**Notes:** JWT is now issued by GoTrue (`HS256`, `app_metadata.store_ids: uuid[]`). Legacy `sub` = user id → same claim name preserved. Legacy `storeId` claim → replaced by `app_metadata.store_ids[0]` (client adapter unifies).

---

## 2. Stores (`/stores`)

| Legacy Endpoint | Method | Guard | v2 Replacement | Status |
|---|---|---|---|---|
| `/stores/me` | GET | JWT | PostgREST `GET /stores?id=eq.<store_id>` (RLS filters) | 🟢 |
| `/stores/me` | PATCH | JWT + owner | PostgREST `PATCH /stores?id=eq.<store_id>` (RLS: owner role only) | 🟢 |
| `/stores/slug-available?slug=` | GET | public | RPC `store_slug_available(p_slug text) returns boolean` | 🟣 |

---

## 3. Categories (`/categories`)

| Legacy Endpoint | Method | v2 Replacement | Status |
|---|---|---|---|
| `GET /categories` | GET | PostgREST `GET /categories?store_id=eq.<sid>&order=sort_order.asc,name.asc` | 🟢 |
| `POST /categories` | POST | PostgREST `POST /categories` (RLS enforces `store_id = jwt_store()`) | 🟢 |
| `PATCH /categories/:id` | PATCH | PostgREST `PATCH /categories?id=eq.<id>` | 🟢 |
| `DELETE /categories/:id` | DELETE | PostgREST `DELETE /categories?id=eq.<id>` — trigger blocks if products reference it | 🟢 |
| `POST /categories/reorder` | POST | RPC `categories_reorder(p_ids uuid[])` — atomic bulk `sort_order` update | 🟣 |

---

## 4. Products (`/products`)

| Legacy Endpoint | Method | v2 Replacement | Status |
|---|---|---|---|
| `GET /products` | GET | PostgREST `GET /products?store_id=eq.<sid>&select=*,category:categories(*)` | 🟢 |
| `POST /products` | POST | PostgREST `POST /products` | 🟢 |
| `PATCH /products/:id` | PATCH | PostgREST `PATCH /products?id=eq.<id>` | 🟢 |
| `DELETE /products/:id` | DELETE | PostgREST `DELETE /products?id=eq.<id>` | 🟢 |
| `POST /products/reorder` | POST | RPC `products_reorder(p_ids uuid[])` | 🟣 |

---

## 5. Orders (`/orders`)

| Legacy Endpoint | Method | v2 Replacement | Status |
|---|---|---|---|
| `GET /orders/live` | GET | PostgREST `GET /orders?store_id=eq.<sid>&status=in.(PENDING,PREPARING,READY)&select=*,items:order_items(*)` + Realtime subscribe | 🟢 |
| `GET /orders/history` | GET | PostgREST with `date_gte`, `date_lte`, `q` filters + pagination via `Range` header | 🟢 |
| `GET /orders/:id` | GET | PostgREST `GET /orders?id=eq.<id>&select=*,items:order_items(*)` | 🟢 |
| `POST /orders` | POST | **RPC `orders_create(p_store_id uuid, p_items jsonb, p_customer jsonb, p_notes text)`** — atomic: locks products, recomputes totals server-side, generates order number via `next_order_number()`, inserts order + items in one txn | 🟣 |
| `PATCH /orders/:id/status` | PATCH | RPC `orders_advance_status(p_order_id uuid, p_next order_status)` — validates transition matrix in SQL | 🟣 |
| `POST /orders/:id/cancel` | POST | RPC `orders_cancel(p_order_id uuid, p_reason text)` | 🟣 |

**Realtime:** Legacy WebSocket gateway → replaced by Supabase Realtime (`postgres_changes` on `orders` filtered by `store_id`).

---

## 6. Public Menu (`/public`)

| Legacy Endpoint | Method | v2 Replacement | Status |
|---|---|---|---|
| `GET /public/store/:slug` | GET (public, no JWT) | PostgREST `GET /public_store_menu?slug=eq.<slug>` — SQL view with `SECURITY INVOKER` bypasses RLS via view grant, returns nested JSON `{ store, categories: [{ ...category, products: [...] }] }` | 🔵 |

---

## 7. Dashboard (`/dashboard`)

| Legacy Endpoint | Method | v2 Replacement | Status |
|---|---|---|---|
| `GET /dashboard/summary?range=` | GET | RPC `dashboard_summary(p_range text)` — returns `{ revenue, orderCount, avgOrderValue, topProducts[] }` | 🟣 |

---

## 8. Reports (`/reports`)

| Legacy Endpoint | Method | v2 Replacement | Status |
|---|---|---|---|
| `GET /reports/sales.csv` | GET | RPC `reports_sales_rows(p_from date, p_to date)` returning `setof record` — client streams to CSV via `papaparse` | 🟣 |

---

## 9. Printers (`/printers`)

| Legacy Endpoint | Method | v2 Replacement | Status |
|---|---|---|---|
| `GET /printers` | GET | PostgREST `GET /printers?store_id=eq.<sid>` | 🟢 |
| `POST /printers` | POST | PostgREST | 🟢 |
| `PATCH /printers/:id` | PATCH | PostgREST | 🟢 |
| `DELETE /printers/:id` | DELETE | PostgREST | 🟢 |
| `POST /printers/:id/test` | POST | ⚪ **Deprecated** in v2 — hardware ping was a no-op stub | ⚪ |

---

## 10. Payments (`/payments`)

Legacy simulated provider only; no external calls. Payment state is a column on `orders` (`payment_status`). No dedicated endpoints exist — mutations flow through `orders_advance_status`. **No new surface required.**

---

## 11. Health (`/health`)

| Legacy Endpoint | Method | v2 Replacement | Status |
|---|---|---|---|
| `GET /health` | GET | PostgREST root `GET /rest/v1/` returns 200 when DB is reachable; Supabase project has built-in `/health` at platform level | 🟢 native |

---

## Summary

| Category | Count |
|---|---|
| Total legacy endpoints | 26 |
| PostgREST-native (🟢) | 15 |
| RPC (🟣) | 9 |
| View (🔵) | 1 |
| Edge Function (🟠) | 1 |
| Deprecated (⚪) | 1 |

**Round-trip guarantee:** every response body from the v2 backend must validate against the corresponding Zod schema in `@virundhu/shared`. CI runs `packages/shared` contract tests against PostgREST fixture responses.
