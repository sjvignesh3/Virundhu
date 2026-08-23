import type { ProductDTO } from "@cartsas/shared";
import type { Product, ProductDraft, ID } from "@/lib/domain/types";
import { apiFetch } from "@/lib/api/client";
import { productFromApi } from "@/lib/api/adapters";
import { emit } from "@/lib/storage/event-bus";
import type { ProductRepo, ProductListFilter } from "../types";

function resolveStoreId(explicit: string | undefined, fallback: () => string | undefined): string {
  const s = explicit ?? fallback();
  if (!s) throw new Error("Store context is not available; log in first.");
  return s;
}

export class ApiProductRepo implements ProductRepo {
  constructor(private readonly getStoreId: () => string | undefined) {}

  async list(storeId: ID, filter?: ProductListFilter): Promise<Product[]> {
    const rows = await apiFetch<ProductDTO[]>(`/stores/${storeId}/products`, {
      query: {
        categoryId: filter?.categoryId,
        availableOnly: filter?.availableOnly ? "true" : undefined,
        search: filter?.search,
      },
    });
    return rows.map(productFromApi);
  }

  async get(_id: ID): Promise<Product | null> {
    return null;
  }

  async create(draft: ProductDraft): Promise<Product> {
    const storeId = resolveStoreId(draft.storeId, this.getStoreId);
    const dto = await apiFetch<ProductDTO>(`/stores/${storeId}/products`, {
      method: "POST",
      body: {
        categoryId: draft.categoryId,
        name: draft.name,
        tamilName: draft.tamilName,
        description: draft.description,
        tamilDescription: draft.tamilDescription,
        price: draft.price,
        unit: draft.unit,
        imageUrl: draft.image,
        isAvailable: draft.available,
        stockQuantity: draft.stock ?? null,
        lowStockThreshold: draft.lowStockThreshold ?? null,
      },
    });
    emit("products");
    return productFromApi(dto);
  }

  async update(id: ID, patch: Partial<ProductDraft>): Promise<Product | null> {
    const storeId = resolveStoreId(patch.storeId, this.getStoreId);
    const dto = await apiFetch<ProductDTO>(`/stores/${storeId}/products/${id}`, {
      method: "PATCH",
      body: {
        ...(patch.categoryId !== undefined && { categoryId: patch.categoryId }),
        ...(patch.name !== undefined && { name: patch.name }),
        ...(patch.tamilName !== undefined && { tamilName: patch.tamilName }),
        ...(patch.description !== undefined && { description: patch.description }),
        ...(patch.tamilDescription !== undefined && { tamilDescription: patch.tamilDescription }),
        ...(patch.price !== undefined && { price: patch.price }),
        ...(patch.unit !== undefined && { unit: patch.unit }),
        ...(patch.image !== undefined && { imageUrl: patch.image }),
        ...(patch.available !== undefined && { isAvailable: patch.available }),
        ...(patch.stock !== undefined && { stockQuantity: patch.stock ?? null }),
        ...(patch.lowStockThreshold !== undefined && {
          lowStockThreshold: patch.lowStockThreshold ?? null,
        }),
      },
    });
    emit("products");
    return productFromApi(dto);
  }

  async remove(id: ID): Promise<boolean> {
    const storeId = resolveStoreId(undefined, this.getStoreId);
    await apiFetch<{ success: boolean }>(`/stores/${storeId}/products/${id}`, {
      method: "DELETE",
    });
    emit("products");
    return true;
  }

  async setAvailability(id: ID, available: boolean): Promise<Product | null> {
    const storeId = resolveStoreId(undefined, this.getStoreId);
    const dto = await apiFetch<ProductDTO>(`/stores/${storeId}/products/${id}/availability`, {
      method: "PATCH",
      body: { isAvailable: available },
    });
    emit("products");
    return productFromApi(dto);
  }
}
