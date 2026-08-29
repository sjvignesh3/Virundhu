export interface PublicMenuStore {
    id: string;
    slug: string;
    name: string;
    tamilName: string | null;
    description: string | null;
    phone: string | null;
    address: string | null;
    logoUrl: string | null;
    imageUrl: string | null;
    /**
     * Vendor Virtual Payment Address. When present, the storefront can
     * generate a `upi://pay?pa=...` intent link on "Pay via UPI". Null →
     * checkout is CASH-only.
     */
    upiId: string | null;
    status: "OPEN" | "CLOSED";
    settings: {
        defaultLanguage: "en" | "ta";
        showTamilNames: boolean;
        showUnavailable: boolean;
        acceptOrders: boolean;
        minimumOrderValue: number;
        estimatedPreparationMinutes: number;
    };
}
export interface PublicMenuProduct {
    id: string;
    name: string;
    tamilName: string | null;
    description: string | null;
    tamilDescription: string | null;
    price: number;
    unit: string;
    imageUrl: string | null;
    stockQuantity: number | null;
    isAvailable: boolean;
    displayOrder: number;
}
export interface PublicMenuCategory {
    id: string;
    name: string;
    tamilName: string | null;
    description: string | null;
    displayOrder: number;
    products: PublicMenuProduct[];
}
export interface PublicMenu {
    slug: string;
    store: PublicMenuStore;
    categories: PublicMenuCategory[];
}
export interface PublicOrderReceiptItem {
    name: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
}
export interface PublicOrderReceipt {
    orderNumber: string;
    status: string;
    paymentStatus: string;
    subtotal: number;
    tax: number;
    total: number;
    placedAt: string;
    items: PublicOrderReceiptItem[];
}
export declare const publicMenuRepo: {
    bySlug(slug: string): Promise<PublicMenu>;
    /**
     * Anonymous receipt lookup used by the success page. Backed by the
     * `public_order_lookup(slug, order_no)` RPC — the `orders` table itself
     * is denied to anon by RLS.
     */
    lookupOrder(slug: string, orderNumber: string): Promise<PublicOrderReceipt>;
};
