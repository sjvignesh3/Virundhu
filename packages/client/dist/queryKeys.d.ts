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
export declare const authKeys: {
    all: readonly ["auth"];
    session: () => readonly ["auth", "session"];
};
export declare const storeKeys: {
    all: readonly ["stores"];
    list: () => readonly ["stores", "list"];
    detail: (storeId: string) => readonly ["stores", "detail", string];
    slugCheck: (slug: string) => readonly ["stores", "slug-check", string];
};
export declare const categoryKeys: {
    all: readonly ["categories"];
    list: (storeId: string) => readonly ["categories", "list", string];
    detail: (id: string) => readonly ["categories", "detail", string];
};
export declare const productKeys: {
    all: readonly ["products"];
    list: (storeId: string, filter?: Record<string, unknown>) => readonly ["products", "list", string, Record<string, unknown>];
    detail: (id: string) => readonly ["products", "detail", string];
    byCategory: (storeId: string, categoryId: string) => readonly ["products", "by-category", string, string];
};
export interface OrderListFilter {
    status?: string[];
    from?: string;
    to?: string;
    search?: string;
    page?: number;
    limit?: number;
}
export declare const orderKeys: {
    all: readonly ["orders"];
    list: (storeId: string, filter?: OrderListFilter) => readonly ["orders", "list", string, OrderListFilter];
    active: (storeId: string) => readonly ["orders", "active", string];
    detail: (id: string) => readonly ["orders", "detail", string];
};
export declare const printerKeys: {
    all: readonly ["printers"];
    list: (storeId: string) => readonly ["printers", "list", string];
    detail: (id: string) => readonly ["printers", "detail", string];
};
export declare const dashboardKeys: {
    all: readonly ["dashboard"];
    summary: (storeId: string) => readonly ["dashboard", "summary", string];
};
export declare const reportsKeys: {
    all: readonly ["reports"];
    sales: (storeId: string, from: string, to: string) => readonly ["reports", "sales", string, string, string];
};
export declare const publicMenuKeys: {
    all: readonly ["public-menu"];
    bySlug: (slug: string) => readonly ["public-menu", "by-slug", string];
};
