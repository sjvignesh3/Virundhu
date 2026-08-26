/**
 * TanStack Query key factory.
 *
 * Structure (fixed positions so `invalidateQueries({ queryKey: ['orders'] })`
 * always sweeps every order-related cache):
 *
 *   [<domain>, <scope>, ...<params>]
 *
 * Every mutation invalidates at least the domain root; specific hooks may
 * additionally `setQueryData` for optimistic patches.
 */

export const authKeys = {
  all: ["auth"] as const,
  session: () => [...authKeys.all, "session"] as const,
};

export const storeKeys = {
  all: ["stores"] as const,
  list: () => [...storeKeys.all, "list"] as const,
  detail: (storeId: string) => [...storeKeys.all, "detail", storeId] as const,
  slugCheck: (slug: string) =>
    [...storeKeys.all, "slug-check", slug] as const,
};

export const categoryKeys = {
  all: ["categories"] as const,
  list: (storeId: string) => [...categoryKeys.all, "list", storeId] as const,
  detail: (id: string) => [...categoryKeys.all, "detail", id] as const,
};

export const productKeys = {
  all: ["products"] as const,
  list: (storeId: string, filter: Record<string, unknown> = {}) =>
    [...productKeys.all, "list", storeId, filter] as const,
  detail: (id: string) => [...productKeys.all, "detail", id] as const,
  byCategory: (storeId: string, categoryId: string) =>
    [...productKeys.all, "by-category", storeId, categoryId] as const,
};

export interface OrderListFilter {
  status?: string[];
  from?: string;
  to?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export const orderKeys = {
  all: ["orders"] as const,
  list: (storeId: string, filter: OrderListFilter = {}) =>
    [...orderKeys.all, "list", storeId, filter] as const,
  active: (storeId: string) => [...orderKeys.all, "active", storeId] as const,
  detail: (id: string) => [...orderKeys.all, "detail", id] as const,
};

export const printerKeys = {
  all: ["printers"] as const,
  list: (storeId: string) => [...printerKeys.all, "list", storeId] as const,
  detail: (id: string) => [...printerKeys.all, "detail", id] as const,
};

export const dashboardKeys = {
  all: ["dashboard"] as const,
  summary: (storeId: string) =>
    [...dashboardKeys.all, "summary", storeId] as const,
};

export const reportsKeys = {
  all: ["reports"] as const,
  sales: (storeId: string, from: string, to: string) =>
    [...reportsKeys.all, "sales", storeId, from, to] as const,
};

export const publicMenuKeys = {
  all: ["public-menu"] as const,
  bySlug: (slug: string) => [...publicMenuKeys.all, "by-slug", slug] as const,
  order: (slug: string, orderNumber: string) =>
    [...publicMenuKeys.all, "order", slug, orderNumber] as const,
};
