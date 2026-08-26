import type { CategoryRow, CategoryInsert, CategoryUpdate } from "@virundhu/shared";
export declare const categoriesRepo: {
    list(storeId: string): Promise<CategoryRow[]>;
    get(id: string): Promise<CategoryRow>;
    create(storeId: string, input: Omit<CategoryInsert, "store_id">): Promise<CategoryRow>;
    update(id: string, patch: CategoryUpdate): Promise<CategoryRow>;
    remove(id: string): Promise<void>;
    reorder(storeId: string, orderedIds: string[]): Promise<void>;
};
