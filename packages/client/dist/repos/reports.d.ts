import type { OrderStatus } from "@virundhu/shared";
export interface SalesReportRow {
    order_number: string;
    created_at: string;
    status: OrderStatus;
    customer_name: string | null;
    subtotal: number;
    tax_amount: number;
    total_amount: number;
    items: number;
}
export declare const reportsRepo: {
    sales(storeId: string, from: string, to: string): Promise<SalesReportRow[]>;
};
