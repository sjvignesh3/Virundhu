/**
 * Stores repo — reads/writes the tenant metadata row.
 *
 * RLS ensures every SELECT/UPDATE is naturally scoped to the caller's
 * `store_members` rows, so we don't need to pass `storeId` for list().
 *
 * NOTE on typing: `.select(columnList)` returns `PostgrestBuilder<GenericStringError>`
 * when the column list isn't a compile-time literal. We use pre-defined column
 * strings from `columns.ts` and cast the result to the known row type. The
 * shape is verified at runtime by the pgTAP tests and by the CI type-gen job
 * that swaps in the Supabase-generated typings.
 */
import { getSupabase } from "../supabase";
import { STORE_DETAIL_COLUMNS, STORE_LIST_COLUMNS } from "../columns";
import { fromPostgrest } from "../errors";
import type { Database, StoreRow, StoreUpdate } from "@virundhu/shared";

type StoreListRow = Pick<
  StoreRow,
  "id" | "slug" | "name" | "tamil_name" | "status" | "logo_url" | "created_at"
>;

export const storesRepo = {
  async list(): Promise<StoreListRow[]> {
    const { data, error } = await getSupabase()
      .from("stores")
      .select(STORE_LIST_COLUMNS)
      .order("created_at", { ascending: false });
    if (error) throw fromPostgrest(error);
    return (data ?? []) as unknown as StoreListRow[];
  },

  async get(storeId: string): Promise<StoreRow> {
    const { data, error } = await getSupabase()
      .from("stores")
      .select(STORE_DETAIL_COLUMNS)
      .eq("id", storeId)
      .single();
    if (error) throw fromPostgrest(error);
    return data as unknown as StoreRow;
  },

  async update(storeId: string, patch: StoreUpdate): Promise<StoreRow> {
    const { data, error } = await getSupabase()
      .from("stores")
      .update(patch as Database["public"]["Tables"]["stores"]["Update"])
      .eq("id", storeId)
      .select(STORE_DETAIL_COLUMNS)
      .single();
    if (error) throw fromPostgrest(error);
    return data as unknown as StoreRow;
  },

  async slugAvailable(slug: string): Promise<boolean> {
    const { data, error } = await getSupabase().rpc("store_slug_available", {
      p_slug: slug,
    });
    if (error) throw fromPostgrest(error);
    return data === true;
  },
};
