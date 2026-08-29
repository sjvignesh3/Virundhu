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
    all: ["auth"],
    session: () => [...authKeys.all, "session"],
};
export const storeKeys = {
    all: ["stores"],
    list: () => [...storeKeys.all, "list"],
    detail: (storeId) => [...storeKeys.all, "detail", storeId],
    slugCheck: (slug) => [...storeKeys.all, "slug-check", slug],
};
export const categoryKeys = {
    all: ["categories"],
    list: (storeId) => [...categoryKeys.all, "list", storeId],
    detail: (id) => [...categoryKeys.all, "detail", id],
};
export const productKeys = {
    all: ["products"],
    list: (storeId, filter = {}) => [...productKeys.all, "list", storeId, filter],
    detail: (id) => [...productKeys.all, "detail", id],
    byCategory: (storeId, categoryId) => [...productKeys.all, "by-category", storeId, categoryId],
};
export const orderKeys = {
    all: ["orders"],
    list: (storeId, filter = {}) => [...orderKeys.all, "list", storeId, filter],
    active: (storeId) => [...orderKeys.all, "active", storeId],
    detail: (id) => [...orderKeys.all, "detail", id],
};
export const printerKeys = {
    all: ["printers"],
    list: (storeId) => [...printerKeys.all, "list", storeId],
    detail: (id) => [...printerKeys.all, "detail", id],
};
export const dashboardKeys = {
    all: ["dashboard"],
    summary: (storeId) => [...dashboardKeys.all, "summary", storeId],
};
export const reportsKeys = {
    all: ["reports"],
    sales: (storeId, from, to) => [...reportsKeys.all, "sales", storeId, from, to],
};
export const publicMenuKeys = {
    all: ["public-menu"],
    bySlug: (slug) => [...publicMenuKeys.all, "by-slug", slug],
    order: (slug, orderNumber) => [...publicMenuKeys.all, "order", slug, orderNumber],
};
