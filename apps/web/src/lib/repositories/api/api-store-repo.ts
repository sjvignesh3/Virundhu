import type { StoreDTO, StoreSettingsDTO, PublicStoreDTO } from "@virundhu/shared";
import type { Store, StoreDraft, ID } from "@/lib/domain/types";
import { apiFetch } from "@/lib/api/client";
import { storeFromApi } from "@/lib/api/adapters";
import { emit } from "@/lib/storage/event-bus";
import type { StoreRepo } from "../types";

export class ApiStoreRepo implements StoreRepo {
  async list(): Promise<Store[]> {
    // Phase 2: single-store frontend uses getBySlug — no listing endpoint yet.
    return [];
  }

  async get(id: ID): Promise<Store | null> {
    try {
      const [store, settings] = await Promise.all([
        apiFetch<StoreDTO>(`/stores/${id}`),
        apiFetch<StoreSettingsDTO>(`/stores/${id}/settings`),
      ]);
      return storeFromApi({ store, settings });
    } catch {
      return null;
    }
  }

  async getBySlug(slug: string): Promise<Store | null> {
    try {
      const dto = await apiFetch<PublicStoreDTO>(`/public/stores/${slug}`, {
        anonymous: true,
      });
      return storeFromApi(dto);
    } catch {
      return null;
    }
  }

  async create(_draft: StoreDraft): Promise<Store> {
    throw new Error("Store creation not yet supported via API");
  }

  async update(id: ID, patch: Partial<StoreDraft>): Promise<Store | null> {
    // Map frontend domain shape → API shape (store + settings).
    const storePatch: Record<string, unknown> = {};
    if (patch.slug !== undefined) storePatch.slug = patch.slug;
    if (patch.name !== undefined) storePatch.name = patch.name;
    if (patch.tamilName !== undefined) storePatch.tamilName = patch.tamilName;
    if (patch.description !== undefined) storePatch.description = patch.description;
    if (patch.phone !== undefined) storePatch.phone = patch.phone;
    if (patch.address !== undefined) storePatch.address = patch.address;
    if (patch.status !== undefined) storePatch.status = patch.status;
    if (patch.logo !== undefined) storePatch.logoUrl = patch.logo;

    const settingsPatch: Record<string, unknown> = {};
    if (patch.showTamilNames !== undefined) settingsPatch.showTamilNames = patch.showTamilNames;
    if (patch.showUnavailable !== undefined) settingsPatch.showUnavailable = patch.showUnavailable;
    if (patch.minOrderValue !== undefined) settingsPatch.minimumOrderValue = patch.minOrderValue;
    if (patch.prepTimeMinutes !== undefined)
      settingsPatch.estimatedPreparationMinutes = patch.prepTimeMinutes;
    if (patch.language !== undefined) settingsPatch.defaultLanguage = patch.language;

    const promises: Promise<unknown>[] = [];
    if (Object.keys(storePatch).length > 0) {
      promises.push(apiFetch<StoreDTO>(`/stores/${id}`, { method: "PATCH", body: storePatch }));
    }
    if (Object.keys(settingsPatch).length > 0) {
      promises.push(
        apiFetch<StoreSettingsDTO>(`/stores/${id}/settings`, {
          method: "PATCH",
          body: settingsPatch,
        }),
      );
    }
    await Promise.all(promises);
    emit("stores");
    return this.get(id);
  }
}
