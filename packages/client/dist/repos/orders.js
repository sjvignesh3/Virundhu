/**
 * Orders repo.
 *
 * Writes MUST go through RPCs (RLS forbids direct INSERT/UPDATE on orders):
 *   - createFromCart  → RPC `orders_create`   (transactional totals + stock)
 *   - advanceStatus   → RPC `orders_advance_status`
 *   - cancel          → RPC `orders_cancel`
 *
 * Reads use PostgREST with column projection (see columns.ts).
 */
import { getSupabase } from "../supabase";
import { fromPostgrest } from "../errors";
import { ORDER_DETAIL_COLUMNS, ORDER_LIST_COLUMNS } from "../columns";
import { ACTIVE_ORDER_STATUSES } from "@virundhu/shared";
export const ordersRepo = {
    async list(storeId, filter = {}) {
        const page = filter.page ?? 1;
        const limit = Math.min(filter.limit ?? 20, 200);
        const from = (page - 1) * limit;
        const to = from + limit - 1;
        let q = getSupabase()
            .from("orders")
            .select(ORDER_LIST_COLUMNS, { count: "exact" })
            .eq("store_id", storeId);
        if (filter.status?.length)
            q = q.in("status", filter.status);
        if (filter.from)
            q = q.gte("created_at", filter.from);
        if (filter.to)
            q = q.lte("created_at", filter.to);
        if (filter.search) {
            q = q.or(`order_number.ilike.%${filter.search}%,customer_name.ilike.%${filter.search}%,customer_phone.ilike.%${filter.search}%`);
        }
        q = q.order("created_at", { ascending: false }).range(from, to);
        const { data, error, count } = await q;
        if (error)
            throw fromPostgrest(error);
        return {
            rows: (data ?? []),
            page,
            limit,
            total: count ?? 0,
        };
    },
    async listActive(storeId) {
        const { data, error } = await getSupabase()
            .from("orders")
            .select(ORDER_LIST_COLUMNS)
            .eq("store_id", storeId)
            .in("status", ACTIVE_ORDER_STATUSES)
            .order("created_at", { ascending: true });
        if (error)
            throw fromPostgrest(error);
        return (data ?? []);
    },
    async get(id) {
        const { data, error } = await getSupabase()
            .from("orders")
            .select(ORDER_DETAIL_COLUMNS)
            .eq("id", id)
            .single();
        if (error)
            throw fromPostgrest(error);
        return data;
    },
    // ─── mutating RPCs ─────────────────────────────────────────────────────────
    async createFromCart(storeId, input) {
        const { data, error } = await getSupabase().rpc("orders_create", {
            p_store_id: storeId,
            p_items: input.items.map((i) => ({
                product_id: i.productId,
                quantity: i.quantity,
            })),
            p_customer_name: input.customer.name ?? null,
            p_customer_phone: input.customer.phone ?? null,
            p_notes: input.notes ?? null,
            // Stage 7: pass the customer-chosen method (CASH | UPI). The DB
            // narrows any other value.
            p_payment_method: input.paymentMethod ?? "CASH",
        });
        if (error)
            throw fromPostgrest(error);
        return data;
    },
    async advanceStatus(orderId, next) {
        const { data, error } = await getSupabase().rpc("orders_advance_status", {
            p_order_id: orderId,
            p_next: next,
        });
        if (error)
            throw fromPostgrest(error);
        return data;
    },
    async cancel(orderId, reason) {
        const { data, error } = await getSupabase().rpc("orders_cancel", {
            p_order_id: orderId,
            p_reason: reason ?? null,
        });
        if (error)
            throw fromPostgrest(error);
        return data;
    },
};
