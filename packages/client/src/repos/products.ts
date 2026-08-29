/**
 * Products repo — RLS scopes reads/writes to the caller's stores.
 */
import { getSupabase } from "../supabase";
import { fromPostgrest } from "../errors";
import { PRODUCT_COLUMNS } from "../columns";
import type {
  ProductRow,
  ProductInsert,
  ProductUpdate,
  Database,
} from "@virundhu/shared";

interface ProductListFilter {
  categoryId?: string;
  isAvailable?: boolean;
  search?: string;
}

export const productsRepo = {
  async list(storeId: string, filter: ProductListFilter = {}): Promise<ProductRow[]> {
    let q = getSupabase()
      .from("products")
      .select(PRODUCT_COLUMNS)
      .eq("store_id", storeId);

    if (filter.categoryId) q = q.eq("category_id", filter.categoryId);
    if (filter.isAvailable !== undefined) q = q.eq("is_available", filter.isAvailable);
    if (filter.search) q = q.ilike("name", `%${filter.search}%`);

    q = q.order("display_order", { ascending: true }).order("name");

    const { data, error } = await q;
    if (error) throw fromPostgrest(error);
    return (data ?? []) as unknown as ProductRow[];
  },

  async get(id: string): Promise<ProductRow> {
    const { data, error } = await getSupabase()
      .from("products")
      .select(PRODUCT_COLUMNS)
      .eq("id", id)
      .single();
    if (error) throw fromPostgrest(error);
    return data as unknown as ProductRow;
  },

  async create(
    storeId: string,
    input: Omit<ProductInsert, "store_id">,
  ): Promise<ProductRow> {
    const row: Database["public"]["Tables"]["products"]["Insert"] = {
      ...(input as ProductInsert),
      store_id: storeId,
    };
    const { data, error } = await getSupabase()
      .from("products")
      .insert(row)
      .select(PRODUCT_COLUMNS)
      .single();
    if (error) throw fromPostgrest(error);
    return data as unknown as ProductRow;
  },

  async update(id: string, patch: ProductUpdate): Promise<ProductRow> {
    const { data, error } = await getSupabase()
      .from("products")
      .update(patch as Database["public"]["Tables"]["products"]["Update"])
      .eq("id", id)
      .select(PRODUCT_COLUMNS)
      .single();
    if (error) throw fromPostgrest(error);
    return data as unknown as ProductRow;
  },

  async setAvailability(id: string, isAvailable: boolean): Promise<ProductRow> {
    return this.update(id, { is_available: isAvailable });
  },

  async remove(id: string): Promise<void> {
    // `.select("id")` returns the deleted rows so an RLS-filtered 0-row
    // delete surfaces as an error instead of a silent success.
    const { data, error } = await getSupabase()
      .from("products")
      .delete()
      .eq("id", id)
      .select("id");
    if (error) throw fromPostgrest(error);
    if (!data || data.length === 0) {
      throw new Error("Product was not deleted — it may not exist or you may not have access.");
    }
  },

  async reorder(storeId: string, orderedIds: string[]): Promise<void> {
    const { error } = await getSupabase().rpc("products_reorder", {
      p_store_id: storeId,
      p_ids: orderedIds,
    });
    if (error) throw fromPostgrest(error);
  },
};
