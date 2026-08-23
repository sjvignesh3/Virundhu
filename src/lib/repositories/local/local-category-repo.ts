import type { Category, CategoryDraft, ID } from "@/lib/domain/types";
import { newId, now } from "@/lib/domain/ids";
import { readCollection, writeCollection } from "@/lib/storage/local-storage";
import { emit } from "@/lib/storage/event-bus";
import { STORAGE_KEYS } from "@/lib/storage/keys";
import type { CategoryRepo } from "../types";

const KEY = STORAGE_KEYS.categories;

export class LocalCategoryRepo implements CategoryRepo {
  async list(storeId: ID): Promise<Category[]> {
    return readCollection<Category>(KEY)
      .filter((c) => c.storeId === storeId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async get(id: ID): Promise<Category | null> {
    return readCollection<Category>(KEY).find((c) => c.id === id) ?? null;
  }

  async create(draft: CategoryDraft): Promise<Category> {
    const list = readCollection<Category>(KEY);
    const ts = now();
    const cat: Category = { ...draft, id: newId(), createdAt: ts, updatedAt: ts };
    list.push(cat);
    writeCollection(KEY, list);
    emit("categories");
    return cat;
  }

  async update(id: ID, patch: Partial<CategoryDraft>): Promise<Category | null> {
    const list = readCollection<Category>(KEY);
    const idx = list.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    const updated: Category = { ...list[idx], ...patch, id, updatedAt: now() };
    list[idx] = updated;
    writeCollection(KEY, list);
    emit("categories");
    return updated;
  }

  async remove(id: ID): Promise<boolean> {
    const list = readCollection<Category>(KEY);
    const next = list.filter((c) => c.id !== id);
    if (next.length === list.length) return false;
    writeCollection(KEY, next);
    emit("categories");
    return true;
  }

  async reorder(storeId: ID, orderedIds: readonly ID[]): Promise<void> {
    const list = readCollection<Category>(KEY);
    const rank = new Map(orderedIds.map((id, i) => [id, i]));
    const ts = now();
    const next = list.map((c) => {
      if (c.storeId !== storeId) return c;
      const r = rank.get(c.id);
      if (r === undefined) return c;
      return { ...c, sortOrder: r, updatedAt: ts };
    });
    writeCollection(KEY, next);
    emit("categories");
  }
}
