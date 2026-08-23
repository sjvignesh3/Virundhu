import type { Store, StoreDraft, ID } from "@/lib/domain/types";
import { newId, now } from "@/lib/domain/ids";
import { readCollection, writeCollection } from "@/lib/storage/local-storage";
import { emit } from "@/lib/storage/event-bus";
import { STORAGE_KEYS } from "@/lib/storage/keys";
import type { StoreRepo } from "../types";

const KEY = STORAGE_KEYS.stores;

export class LocalStoreRepo implements StoreRepo {
  async list(): Promise<Store[]> {
    return readCollection<Store>(KEY);
  }

  async get(id: ID): Promise<Store | null> {
    const list = readCollection<Store>(KEY);
    return list.find((s) => s.id === id) ?? null;
  }

  async getBySlug(slug: string): Promise<Store | null> {
    const list = readCollection<Store>(KEY);
    return list.find((s) => s.slug === slug) ?? null;
  }

  async create(draft: StoreDraft): Promise<Store> {
    const list = readCollection<Store>(KEY);
    const ts = now();
    const store: Store = { ...draft, id: newId(), createdAt: ts, updatedAt: ts };
    list.push(store);
    writeCollection(KEY, list);
    emit("stores");
    return store;
  }

  async update(id: ID, patch: Partial<StoreDraft>): Promise<Store | null> {
    const list = readCollection<Store>(KEY);
    const idx = list.findIndex((s) => s.id === id);
    if (idx === -1) return null;
    const updated: Store = { ...list[idx], ...patch, id, updatedAt: now() };
    list[idx] = updated;
    writeCollection(KEY, list);
    emit("stores");
    return updated;
  }
}
