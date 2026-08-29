/**
 * Categories repo — RLS scopes reads/writes to the caller's stores.
 */
import { getSupabase } from "../supabase";
import { fromPostgrest } from "../errors";
import { CATEGORY_COLUMNS } from "../columns";
import type {
  CategoryRow,
  CategoryInsert,
  CategoryUpdate,
  Database,
} from "@virundhu/shared";

export const categoriesRepo = {
  async list(storeId: string): Promise<CategoryRow[]> {
    const { data, error } = await getSupabase()
      .from("categories")
      .select(CATEGORY_COLUMNS)
      .eq("store_id", storeId)
      .order("display_order", { ascending: true });
    if (error) throw fromPostgrest(error);
    return (data ?? []) as unknown as CategoryRow[];
  },

  async get(id: string): Promise<CategoryRow> {
    const { data, error } = await getSupabase()
      .from("categories")
      .select(CATEGORY_COLUMNS)
      .eq("id", id)
      .single();
    if (error) throw fromPostgrest(error);
    return data as unknown as CategoryRow;
  },

  async create(
    storeId: string,
    input: Omit<CategoryInsert, "store_id">,
  ): Promise<CategoryRow> {
    const row: Database["public"]["Tables"]["categories"]["Insert"] = {
      ...(input as CategoryInsert),
      store_id: storeId,
    };
    const { data, error } = await getSupabase()
      .from("categories")
      .insert(row)
      .select(CATEGORY_COLUMNS)
      .single();
    if (error) throw fromPostgrest(error);
    return data as unknown as CategoryRow;
  },

  async update(id: string, patch: CategoryUpdate): Promise<CategoryRow> {
    const { data, error } = await getSupabase()
      .from("categories")
      .update(patch as Database["public"]["Tables"]["categories"]["Update"])
      .eq("id", id)
      .select(CATEGORY_COLUMNS)
      .single();
    if (error) throw fromPostgrest(error);
    return data as unknown as CategoryRow;
  },

  async remove(id: string): Promise<void> {
    // `.select("id")` makes PostgREST return the deleted rows — an RLS-filtered
    // delete otherwise "succeeds" with 0 rows and the UI lies about it.
    const { data, error } = await getSupabase()
      .from("categories")
      .delete()
      .eq("id", id)
      .select("id");
    if (error) throw fromPostgrest(error);
    if (!data || data.length === 0) {
      throw new Error("Category was not deleted — it may not exist or you may not have access.");
    }
  },

  async reorder(storeId: string, orderedIds: string[]): Promise<void> {
    const { error } = await getSupabase().rpc("categories_reorder", {
      p_store_id: storeId,
      p_ids: orderedIds,
    });
    if (error) throw fromPostgrest(error);
  },
};
