export interface DashboardSummary {
    range: string;
    revenue: number;
    orderCount: number;
    avgOrderValue: number;
    topProducts: Array<{
        product_id: string | null;
        name: string;
        qty: number;
        revenue: number;
    }>;
}
export declare const dashboardRepo: {
    summary(storeId: string, range?: string): Promise<DashboardSummary>;
};
