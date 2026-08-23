import type { Product, ProductDraft, ID } from "@/lib/domain/types";
import { newId, now } from "@/lib/domain/ids";
import { readCollection, writeCollection } from "@/lib/storage/local-storage";
import { emit } from "@/lib/storage/event-bus";
import { STORAGE_KEYS } from "@/lib/storage/keys";
import type { ProductRepo, ProductListFilter } from "../types";

const KEY = STORAGE_KEYS.products;

export class LocalProductRepo implements ProductRepo {
  async list(storeId: ID, filter?: ProductListFilter): Promise<Product[]> {
    let list = readCollection<Product>(KEY).filter((p) => p.storeId === storeId);
    if (filter?.categoryId) {
      list = list.filter((p) => p.categoryId === filter.categoryId);
    }
    if (filter?.availableOnly) {
      list = list.filter((p) => p.available);
    }
    if (filter?.search) {
      const q = filter.search.trim().toLowerCase();
      if (q) {
        list = list.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.tamilName?.toLowerCase().includes(q) ?? false),
        );
      }
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }

  async get(id: ID): Promise<Product | null> {
    return readCollection<Product>(KEY).find((p) => p.id === id) ?? null;
  }

  async create(draft: ProductDraft): Promise<Product> {
    const list = readCollection<Product>(KEY);
    const ts = now();
    const p: Product = { ...draft, id: newId(), createdAt: ts, updatedAt: ts };
    list.push(p);
    writeCollection(KEY, list);
    emit("products");
    return p;
  }

  async update(id: ID, patch: Partial<ProductDraft>): Promise<Product | null> {
    const list = readCollection<Product>(KEY);
    const idx = list.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    const updated: Product = { ...list[idx], ...patch, id, updatedAt: now() };
    list[idx] = updated;
    writeCollection(KEY, list);
    emit("products");
    return updated;
  }

  async remove(id: ID): Promise<boolean> {
    const list = readCollection<Product>(KEY);
    const next = list.filter((p) => p.id !== id);
    if (next.length === list.length) return false;
    writeCollection(KEY, next);
    emit("products");
    return true;
  }

  async setAvailability(id: ID, available: boolean): Promise<Product | null> {
    return this.update(id, { available });
  }
}
