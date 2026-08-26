import type { OrderRow, OrderItemRow, OrderStatus, PublicCreateOrderInput } from "@virundhu/shared";
type OrderWithItems = OrderRow & {
    items: OrderItemRow[];
};
export interface OrderListFilter {
    status?: OrderStatus[];
    from?: string;
    to?: string;
    search?: string;
    page?: number;
    limit?: number;
}
export interface OrderListResult {
    rows: OrderRow[];
    page: number;
    limit: number;
    total: number;
}
export declare const ordersRepo: {
    list(storeId: string, filter?: OrderListFilter): Promise<OrderListResult>;
    listActive(storeId: string): Promise<OrderRow[]>;
    get(id: string): Promise<OrderWithItems>;
    createFromCart(storeId: string, input: PublicCreateOrderInput): Promise<OrderRow>;
    advanceStatus(orderId: string, next: OrderStatus): Promise<OrderRow>;
    cancel(orderId: string, reason?: string): Promise<OrderRow>;
};
export {};
