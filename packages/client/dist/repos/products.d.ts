import type { ProductRow, ProductInsert, ProductUpdate } from "@virundhu/shared";
interface ProductListFilter {
    categoryId?: string;
    isAvailable?: boolean;
    search?: string;
}
export declare const productsRepo: {
    list(storeId: string, filter?: ProductListFilter): Promise<ProductRow[]>;
    get(id: string): Promise<ProductRow>;
    create(storeId: string, input: Omit<ProductInsert, "store_id">): Promise<ProductRow>;
    update(id: string, patch: ProductUpdate): Promise<ProductRow>;
    setAvailability(id: string, isAvailable: boolean): Promise<ProductRow>;
    remove(id: string): Promise<void>;
    reorder(storeId: string, orderedIds: string[]): Promise<void>;
};
export {};
