/**
 * Column projections — every SELECT in a repo pulls its column list from
 * here. Two goals:
 *   1. Egress control: never `select('*')` (banned by ESLint + grep-in-CI).
 *   2. Single source of truth: adding a column to the schema is a one-file
 *      change here and every list/detail query updates.
 *
 * Naming convention:
 *   - `_LIST_COLUMNS`   → paginated list view (cheap)
 *   - `_DETAIL_COLUMNS` → single-record view (may include relations)
 */
export declare const STORE_LIST_COLUMNS: string;
export declare const STORE_DETAIL_COLUMNS: string;
export declare const CATEGORY_COLUMNS: string;
export declare const PRODUCT_COLUMNS: string;
export declare const ORDER_LIST_COLUMNS: string;
export declare const ORDER_DETAIL_COLUMNS: string;
export declare const PRINTER_COLUMNS: string;
