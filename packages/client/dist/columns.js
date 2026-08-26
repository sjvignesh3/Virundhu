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
export const STORE_LIST_COLUMNS = [
    "id",
    "slug",
    "name",
    "tamil_name",
    "status",
    "logo_url",
    "created_at",
].join(", ");
export const STORE_DETAIL_COLUMNS = [
    "id",
    "slug",
    "name",
    "tamil_name",
    "description",
    "phone",
    "address",
    "logo_url",
    "image_url",
    "status",
    "default_language",
    "show_tamil_names",
    "show_unavailable",
    "accept_orders",
    "minimum_order_value",
    "estimated_preparation_minutes",
    "created_at",
    "updated_at",
].join(", ");
export const CATEGORY_COLUMNS = [
    "id",
    "store_id",
    "name",
    "tamil_name",
    "description",
    "display_order",
    "is_active",
    "created_at",
    "updated_at",
].join(", ");
export const PRODUCT_COLUMNS = [
    "id",
    "store_id",
    "category_id",
    "name",
    "tamil_name",
    "description",
    "tamil_description",
    "price",
    "unit",
    "image_url",
    "is_available",
    "stock_quantity",
    "low_stock_threshold",
    "display_order",
    "created_at",
    "updated_at",
].join(", ");
export const ORDER_LIST_COLUMNS = [
    "id",
    "order_number",
    "status",
    "payment_status",
    "payment_method",
    "customer_name",
    "customer_phone",
    "total_amount",
    "notes",
    "created_at",
    "updated_at",
    "completed_at",
    "cancelled_at",
].join(", ");
export const ORDER_DETAIL_COLUMNS = [
    ORDER_LIST_COLUMNS,
    "store_id",
    "subtotal",
    "discount_amount",
    "tax_amount",
    "items:order_items(id,product_id,product_name,product_tamil_name,unit,unit_price,quantity,line_total)",
].join(", ");
export const PRINTER_COLUMNS = [
    "id",
    "store_id",
    "name",
    "type",
    "connection_status",
    "address",
    "is_active",
    "created_at",
    "updated_at",
].join(", ");
