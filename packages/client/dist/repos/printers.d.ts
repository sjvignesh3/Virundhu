import type { PrinterRow, PrinterInsert, PrinterUpdate } from "@virundhu/shared";
export declare const printersRepo: {
    list(storeId: string): Promise<PrinterRow[]>;
    create(storeId: string, input: Omit<PrinterInsert, "store_id">): Promise<PrinterRow>;
    update(id: string, patch: PrinterUpdate): Promise<PrinterRow>;
    remove(id: string): Promise<void>;
};
