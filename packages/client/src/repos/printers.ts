/**
 * Printers repo — CRUD + status tick. RLS scopes to caller's stores.
 */
import { getSupabase } from "../supabase";
import { fromPostgrest } from "../errors";
import { PRINTER_COLUMNS } from "../columns";
import type {
  PrinterRow,
  PrinterInsert,
  PrinterUpdate,
  Database,
} from "@virundhu/shared";

export const printersRepo = {
  async list(storeId: string): Promise<PrinterRow[]> {
    const { data, error } = await getSupabase()
      .from("printers")
      .select(PRINTER_COLUMNS)
      .eq("store_id", storeId)
      .order("created_at");
    if (error) throw fromPostgrest(error);
    return (data ?? []) as unknown as PrinterRow[];
  },

  async create(
    storeId: string,
    input: Omit<PrinterInsert, "store_id">,
  ): Promise<PrinterRow> {
    const row: Database["public"]["Tables"]["printers"]["Insert"] = {
      ...(input as PrinterInsert),
      store_id: storeId,
    };
    const { data, error } = await getSupabase()
      .from("printers")
      .insert(row)
      .select(PRINTER_COLUMNS)
      .single();
    if (error) throw fromPostgrest(error);
    return data as unknown as PrinterRow;
  },

  async update(id: string, patch: PrinterUpdate): Promise<PrinterRow> {
    const { data, error } = await getSupabase()
      .from("printers")
      .update(patch as Database["public"]["Tables"]["printers"]["Update"])
      .eq("id", id)
      .select(PRINTER_COLUMNS)
      .single();
    if (error) throw fromPostgrest(error);
    return data as unknown as PrinterRow;
  },

  async remove(id: string): Promise<void> {
    const { error } = await getSupabase().from("printers").delete().eq("id", id);
    if (error) throw fromPostgrest(error);
  },
};
