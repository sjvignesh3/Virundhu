import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { ApiCategoryRepo } from "./api-category-repo";
import * as clientModule from "@/lib/api/client";
import { subscribe } from "@/lib/storage/event-bus";

/**
 * Regression test for the "Category added but not showing up" bug:
 *
 * The API repos must emit a change event on the shared event-bus after every
 * successful mutation, so `useCollection` re-fetches the list in API mode
 * (same behaviour we already had in local mode). If this test fails, newly
 * added categories will not appear until the page is manually reloaded.
 */
describe("ApiCategoryRepo → emits 'categories' events on writes", () => {
  const STORE_ID = "store_1";
  const CATEGORY_DTO = {
    id: "cat_1",
    storeId: STORE_ID,
    name: "Chicken",
    tamilName: null,
    description: null,
    displayOrder: 0,
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };

  let repo: ApiCategoryRepo;
  let listener: ReturnType<typeof vi.fn>;
  let unsubscribe: () => void;

  beforeEach(() => {
    vi.spyOn(clientModule, "apiFetch").mockResolvedValue(CATEGORY_DTO);
    repo = new ApiCategoryRepo(() => STORE_ID);
    listener = vi.fn();
    unsubscribe = subscribe("categories", listener);
  });

  afterEach(() => {
    unsubscribe();
    vi.restoreAllMocks();
  });

  it("emits after create()", async () => {
    await repo.create({ storeId: STORE_ID, name: "Chicken", sortOrder: 0 });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("emits after update()", async () => {
    await repo.update("cat_1", { storeId: STORE_ID, name: "Renamed" });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("emits after remove()", async () => {
    vi.spyOn(clientModule, "apiFetch").mockResolvedValueOnce({ success: true });
    await repo.remove("cat_1");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("emits once after reorder() (batched)", async () => {
    await repo.reorder(STORE_ID, ["a", "b", "c"]);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
