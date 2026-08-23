import { LocalStoreRepo } from "./local/local-store-repo";
import { LocalCategoryRepo } from "./local/local-category-repo";
import { LocalProductRepo } from "./local/local-product-repo";
import { LocalOrderRepo } from "./local/local-order-repo";
import { ApiStoreRepo } from "./api/api-store-repo";
import { ApiCategoryRepo } from "./api/api-category-repo";
import { ApiProductRepo } from "./api/api-product-repo";
import { ApiOrderRepo } from "./api/api-order-repo";
import type { StoreRepo, CategoryRepo, ProductRepo, OrderRepo } from "./types";
import { apiCurrentSession } from "@/lib/api/auth-api";

export interface Repos {
  stores: StoreRepo;
  categories: CategoryRepo;
  products: ProductRepo;
  orders: OrderRepo;
}

export type RepoBackend = "api" | "local";

/**
 * Backend selection is a build-time env flag so we never accidentally ship a
 * localStorage-only build. Defaults to "api" in Phase 2. Set
 * `NEXT_PUBLIC_REPO_BACKEND=local` to keep the Phase 1 offline demo mode.
 */
export function chosenBackend(): RepoBackend {
  return (process.env.NEXT_PUBLIC_REPO_BACKEND as RepoBackend) === "local" ? "local" : "api";
}

let cached: Repos | null = null;
let cachedBackend: RepoBackend | null = null;

export function getRepos(): Repos {
  const backend = chosenBackend();
  if (cached && cachedBackend === backend) return cached;
  if (backend === "local") {
    cached = {
      stores: new LocalStoreRepo(),
      categories: new LocalCategoryRepo(),
      products: new LocalProductRepo(),
      orders: new LocalOrderRepo(),
    };
  } else {
    const currentStoreId = () => apiCurrentSession()?.storeId;
    cached = {
      stores: new ApiStoreRepo(),
      categories: new ApiCategoryRepo(currentStoreId),
      products: new ApiProductRepo(currentStoreId),
      orders: new ApiOrderRepo(),
    };
  }
  cachedBackend = backend;
  return cached;
}

/**
 * Force the singleton to be rebuilt (e.g. after login so a stale
 * unauthenticated instance is dropped). Called by the auth flow.
 */
export function resetReposCache(): void {
  cached = null;
  cachedBackend = null;
}
