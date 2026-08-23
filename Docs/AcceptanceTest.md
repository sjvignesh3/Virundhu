# Acceptance Test — Requirements §32

Phase 1 is considered complete when this exact scenario passes on the
seeded `Anna Street Food` demo store. Run through it manually (or scripted)
after every meaningful change.

**Setup**

```bash
cd /home/workspace/CartSas
npm install           # first time only
npm run dev           # serves http://localhost:3000
```

Open two browser tabs (or a phone + laptop on the same LAN):

- **Owner tab:** http://localhost:3000/dashboard
- **Customer tab:** http://localhost:3000/order/anna-street-food

If this is the *first* run in this browser, the seed populates:
- 1 store: Anna Street Food
- 5 categories: Chicken · Snacks · Rice & Meals · Drinks · Egg
- 10 products (see DevDoc §6)

To re-seed at any time: DevTools → Application → Local Storage → clear origin → reload.

---

## Scenario walkthrough

| #  | Action                                        | Route / Surface                       | Expected result                                                                                       | Verified by |
| -- | --------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------- |
| 1  | Open owner dashboard                          | `/dashboard`                          | Today stats + Menu stats + Live Orders preview render. Greeting includes store name.                  | Step 13     |
| 2  | Open Products                                 | `/products`                           | 10 seeded products in a filterable grid.                                                              | Step 7      |
| 3  | Confirm Food Cart products exist              | `/products`                           | Chicken Kothu Parotta ₹120, Lemon Soda ₹40, etc. — matches DevDoc §6.                                 | Seed        |
| 4  | Open customer QR modal                        | `/qr`                                 | Scannable PNG QR + Copy / Download / Print poster / Open buttons.                                     | Step 15     |
| 5  | Open customer order URL                       | `/order/anna-street-food`             | Menu renders with hero, category chips, product cards.                                                | Step 8      |
| 6  | Browse categories                             | `/order/anna-street-food`             | Tap chips to scroll to that section. Sticky nav follows viewport.                                     | Step 8      |
| 7  | Add Chicken Kothu Parotta × 2 + Lemon Soda × 1| Menu page                             | Sticky bar shows *3 items · ₹280*.                                                                    | Step 8      |
| 8  | Verify cart total is correct                  | Cart sheet                            | Subtotal = 2×120 + 1×40 = **₹280**. Total = ₹280 (no fees Phase 1).                                   | Step 9      |
| 9  | Click Pay Now                                 | Cart sheet                            | Simulated payment: 400 ms delay → success → redirect.                                                 | Step 9      |
| 10 | Verify order is created                       | `/order/anna-street-food/success/…`   | Confirmation page renders with items & totals.                                                        | Step 10     |
| 11 | Verify order number is displayed              | Success page                          | Format `FC-1001` (increments per store). Status badge = **NEW**.                                       | Step 10     |
| 12 | Open owner Live Order Board                   | `/orders/live` (owner tab)            | Cross-tab: the new order appears **without hard reload**.                                             | Step 11     |
| 13 | Verify order appears under NEW ORDERS         | `/orders/live` NEW column             | Card shows order number, item count, subtotal, "N seconds ago".                                       | Step 11     |
| 14 | Click Accept Order (via detail sheet)         | Order detail sheet                    | Only valid next statuses shown (ACCEPTED, CANCELLED).                                                  | Step 10/11  |
| 15 | Verify it moves to ACCEPTED                   | `/orders/live` ACCEPTED column        | Card moves columns instantly. Toast: "Marked as ACCEPTED".                                             | Step 11     |
| 16 | Click Start Preparing                         | Detail sheet                          | Repository enforces `canTransition`.                                                                   | Step 10     |
| 17 | Verify it moves to PREPARING                  | `/orders/live` PREPARING column       | Column updates.                                                                                       | Step 11     |
| 18 | Click Mark Ready                              | Detail sheet                          | Transition enforced.                                                                                   | Step 10     |
| 19 | Verify it moves to READY                      | `/orders/live` READY column           | Column updates.                                                                                       | Step 11     |
| 20 | Click Complete                                | Detail sheet                          | `completedAt` timestamp set by repo.                                                                   | Step 10     |
| 21 | Verify it disappears from active orders       | `/orders/live`                        | Empty state (or remaining orders only). COMPLETED is not shown on the Kanban.                          | Step 11     |
| 22 | Open Order History                            | `/orders/history`                     | Table / mobile list of COMPLETED + CANCELLED orders.                                                   | Step 12     |
| 23 | Verify completed order appears there          | `/orders/history`                     | The `FC-…` order is listed with green **Completed** badge. Revenue badge in header includes its total.| Step 12     |
| 24 | Open Dashboard                                | `/dashboard`                          | Today stats refresh (cross-tab).                                                                       | Step 13     |
| 25 | Verify order/revenue metrics reflect the order| `/dashboard`                          | Revenue += ₹280. Orders count +1. Completed +1. Top items includes CKP ×2.                             | Step 13     |
| 26 | Verify customer cart is empty after success   | `/order/anna-street-food`             | Sticky cart bar gone. `sessionStorage[cartsas:v1:cart:anna-street-food]` = `[]`.                       | `cart.clear()` in `handlePlace` |
| 27 | Verify responsive behaviour on mobile viewport| DevTools 375×667 or real phone        | Sidebar hides, mobile tab bar shows, cards stack, QR scannable.                                        | Step 17     |
| 28 | Verify the same app remains usable on desktop | 1440×900+                             | Two-column dashboard, three-column products, four-column Kanban.                                       | Step 4/17   |

---

## Automated coverage snapshot

`npm test` — Vitest, 54 tests across the domain layer that back this scenario:

| Suite                          | Tests | Covers                                                    |
| ------------------------------ | ----- | --------------------------------------------------------- |
| `order-number.test.ts`         | 3     | FC-1001+ formatter, monotonic sequence.                    |
| `totals.test.ts`               | 6     | `computeOrderTotals`, `buildOrderItem` price snapshot.     |
| `order-status.test.ts`         | 9     | Full transition graph, terminal states, `nextValidStatuses`.|
| `order-service.test.ts`        | 13    | `createOrder` validation branches + happy path.            |
| `dashboard-metrics.test.ts`    | 9     | Today window, active vs completed, product classification. |
| `csv.test.ts`                  | 14    | RFC 4180 quoting, BOM, multi-item summary.                 |

`npx tsc --noEmit` — zero errors across the tree.

`npm run build` — 14 routes compile and prerender clean.

---

## Regression protocol

Whenever any of the following changes, re-run the full walkthrough:

1. Anything in `src/lib/domain/` (pure logic).
2. `LocalOrderRepo` (state-machine enforcement, order numbering).
3. `RepoProvider`, seed script, or storage keys.
4. Cart / checkout / success routes.
5. Live board detail sheet transitions.

Log the outcome under **§7 Progress log** in `Docs/DevDoc.md`.
