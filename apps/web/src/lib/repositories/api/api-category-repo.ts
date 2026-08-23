import type { CategoryDTO } from "@cartsas/shared";
import type { Category, CategoryDraft, ID } from "@/lib/domain/types";
import { apiFetch } from "@/lib/api/client";
import { categoryFromApi } from "@/lib/api/adapters";
import { emit } from "@/lib/storage/event-bus";
import type { CategoryRepo } from "../types";

/**
 * The API repo needs storeId for scoped endpoints, but the UI often calls
 * `update(id, patch)` / `remove(id)` without one. We resolve storeId in this
 * priority: (a) explicit in the patch, (b) the currently logged-in session's
 * storeId, (c) throw. This lets Phase 1 UI keep the exact same call shape.
 */
function resolveStoreId(explicit: string | undefined, fallback: () => string | undefined): string {
  const s = explicit ?? fallback();
  if (!s) throw new Error("Store context is not available; log in first.");
  return s;
}

export class ApiCategoryRepo implements CategoryRepo {
  constructor(private readonly getStoreId: () => string | undefined) {}

  async list(storeId: ID): Promise<Category[]> {
    const rows = await apiFetch<CategoryDTO[]>(`/stores/${storeId}/categories`);
    return rows.map(categoryFromApi);
  }

  async get(_id: ID): Promise<Category | null> {
    return null;
  }

  async create(draft: CategoryDraft): Promise<Category> {
    const storeId = resolveStoreId(draft.storeId, this.getStoreId);
    const dto = await apiFetch<CategoryDTO>(`/stores/${storeId}/categories`, {
      method: "POST",
      body: {
        name: draft.name,
        tamilName: draft.tamilName,
        displayOrder: draft.sortOrder,
        isActive: true,
      },
    });
    emit("categories");
    return categoryFromApi(dto);
  }

  async update(id: ID, patch: Partial<CategoryDraft>): Promise<Category | null> {
    const storeId = resolveStoreId(patch.storeId, this.getStoreId);
    const dto = await apiFetch<CategoryDTO>(`/stores/${storeId}/categories/${id}`, {
      method: "PATCH",
      body: {
        ...(patch.name !== undefined && { name: patch.name }),
        ...(patch.tamilName !== undefined && { tamilName: patch.tamilName }),
        ...(patch.sortOrder !== undefined && { displayOrder: patch.sortOrder }),
      },
    });
    emit("categories");
    return categoryFromApi(dto);
  }

  async remove(id: ID): Promise<boolean> {
    const storeId = resolveStoreId(undefined, this.getStoreId);
    await apiFetch<{ success: boolean }>(`/stores/${storeId}/categories/${id}`, {
      method: "DELETE",
    });
    emit("categories");
    return true;
  }

  async reorder(storeId: ID, orderedIds: readonly ID[]): Promise<void> {
    await Promise.all(
      orderedIds.map((id, idx) =>
        apiFetch(`/stores/${storeId}/categories/${id}`, {
          method: "PATCH",
          body: { displayOrder: idx },
        }),
      ),
    );
    emit("categories");
  }
}
