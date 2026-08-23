import { LocalStoreRepo } from "./local/local-store-repo";
import { LocalCategoryRepo } from "./local/local-category-repo";
import { LocalProductRepo } from "./local/local-product-repo";
import { LocalOrderRepo } from "./local/local-order-repo";
import type { StoreRepo, CategoryRepo, ProductRepo, OrderRepo } from "./types";

export interface Repos {
  stores: StoreRepo;
  categories: CategoryRepo;
  products: ProductRepo;
  orders: OrderRepo;
}

let cached: Repos | null = null;

/**
 * Returns the singleton repo bundle. The repos themselves are stateless — they
 * read/write localStorage on every call — but we memoize the instances so
 * consumers can rely on reference equality.
 */
export function getRepos(): Repos {
  if (cached) return cached;
  cached = {
    stores: new LocalStoreRepo(),
    categories: new LocalCategoryRepo(),
    products: new LocalProductRepo(),
    orders: new LocalOrderRepo(),
  };
  return cached;
}
