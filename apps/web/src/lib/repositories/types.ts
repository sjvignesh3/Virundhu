/**
 * Repository interfaces — the seam between domain logic and storage.
 *
 * Phase 1 backs these with `localStorage` (see Step 6). Later phases can swap
 * in a REST/GraphQL/DB implementation without touching UI code, as long as the
 * signatures stay stable.
 *
 * Design notes:
 * - All methods are async so a network-backed implementation is a drop-in
 *   replacement. The localStorage impl will resolve synchronously wrapped in
 *   `Promise.resolve`.
 * - Repos own id assignment and timestamps. Callers pass "draft" shapes.
 * - Mutations return the persisted entity (or `null` when the row doesn't
 *   exist) so callers don't need to re-fetch.
 * - Queries always take `storeId` first — no cross-tenant leakage.
 */

import type {
  Category,
  CategoryDraft,
  ID,
  Order,
  OrderDraft,
  OrderStatus,
  PaymentStatus,
  Product,
  ProductDraft,
  Store,
  StoreDraft,
} from '../domain/types';

// -- Store --------------------------------------------------------------------

export interface StoreRepo {
  get(id: ID): Promise<Store | null>;
  getBySlug(slug: string): Promise<Store | null>;
  list(): Promise<Store[]>;
  create(draft: StoreDraft): Promise<Store>;
  update(id: ID, patch: Partial<StoreDraft>): Promise<Store | null>;
}

// -- Category -----------------------------------------------------------------

export interface CategoryRepo {
  list(storeId: ID): Promise<Category[]>;
  get(id: ID): Promise<Category | null>;
  create(draft: CategoryDraft): Promise<Category>;
  update(id: ID, patch: Partial<CategoryDraft>): Promise<Category | null>;
  remove(id: ID): Promise<boolean>;
  reorder(storeId: ID, orderedIds: readonly ID[]): Promise<void>;
}

// -- Product ------------------------------------------------------------------

export interface ProductListFilter {
  categoryId?: ID;
  availableOnly?: boolean;
  search?: string;
}

export interface ProductRepo {
  list(storeId: ID, filter?: ProductListFilter): Promise<Product[]>;
  get(id: ID): Promise<Product | null>;
  create(draft: ProductDraft): Promise<Product>;
  update(id: ID, patch: Partial<ProductDraft>): Promise<Product | null>;
  remove(id: ID): Promise<boolean>;
  setAvailability(id: ID, available: boolean): Promise<Product | null>;
}

// -- Order --------------------------------------------------------------------

export interface OrderListFilter {
  status?: OrderStatus | OrderStatus[];
  from?: string; // ISO date
  to?: string; // ISO date
  search?: string; // matches orderNumber / customer name / phone
}

export interface OrderRepo {
  list(storeId: ID, filter?: OrderListFilter): Promise<Order[]>;
  get(id: ID): Promise<Order | null>;
  getByNumber(storeId: ID, orderNumber: string): Promise<Order | null>;

  /** Creates a new order — repo assigns id, orderNumber (via internal sequence), timestamps. */
  create(draft: OrderDraft): Promise<Order>;

  /**
   * Customer checkout — atomically validates + creates the order server-side.
   * Prefer this over `create()` from the CX flow: it runs the whole cart
   * through the backend so pricing, stock and totals cannot be tampered with.
   * The Phase-1 localStorage repo falls back to a client-side implementation.
   */
  checkout?(
    input: {
      storeSlug: string;
      customer: { name?: string; phone?: string };
      notes?: string;
      items: readonly { productId: string; quantity: number }[];
    },
  ): Promise<Order>;

  /**
   * Transition an order to `next`. Repo MUST validate via `canTransition`
   * and reject invalid transitions with an Error. Sets `completedAt` when
   * transitioning into COMPLETED.
   */
  transition(id: ID, next: OrderStatus): Promise<Order>;

  setPaymentStatus(id: ID, next: PaymentStatus): Promise<Order | null>;
}
