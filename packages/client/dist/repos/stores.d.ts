import type { StoreRow, StoreUpdate } from "@virundhu/shared";
type StoreListRow = Pick<StoreRow, "id" | "slug" | "name" | "tamil_name" | "status" | "logo_url" | "created_at">;
export declare const storesRepo: {
    list(): Promise<StoreListRow[]>;
    get(storeId: string): Promise<StoreRow>;
    update(storeId: string, patch: StoreUpdate): Promise<StoreRow>;
    slugAvailable(slug: string): Promise<boolean>;
};
export {};
