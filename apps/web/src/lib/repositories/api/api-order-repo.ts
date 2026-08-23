import type { OrderDTO, PaginatedResponse, PublicCreateOrderInput } from "@cartsas/shared";
import type {
  ID,
  Order,
  OrderDraft,
  OrderStatus,
  PaymentStatus,
} from "@/lib/domain/types";
import { apiFetch } from "@/lib/api/client";
import { orderFromApi } from "@/lib/api/adapters";
import { apiCurrentSession } from "@/lib/api/auth-api";
import { emit } from "@/lib/storage/event-bus";
import type { OrderRepo, OrderListFilter } from "../types";

/**
 * Frontend Order repo backed by the NestJS API. Owner endpoints use the
 * bearer token attached automatically by `apiFetch`; public order creation
 * is done via `createPublic(slug, input)` on the CX flow.
 */
export class ApiOrderRepo implements OrderRepo {
  async list(storeId: ID, filter?: OrderListFilter): Promise<Order[]> {
    // Live-board pull: no filter → active endpoint; otherwise the full
    // paginated history endpoint (returns first 100 orders which is plenty
    // for local rendering — proper pagination lives in the History page).
    const isActiveQuery =
      filter?.status &&
      Array.isArray(filter.status) &&
      filter.status.every((s) => s === "NEW" || s === "ACCEPTED" || s === "PREPARING" || s === "READY");

    if (isActiveQuery) {
      const rows = await apiFetch<OrderDTO[]>(`/stores/${storeId}/orders/active`);
      return rows.map(orderFromApi);
    }

    const statuses = filter?.status
      ? Array.isArray(filter.status)
        ? filter.status
        : [filter.status]
      : undefined;

    const resp = await apiFetch<PaginatedResponse<OrderDTO>>(`/stores/${storeId}/orders`, {
      query: {
        status: statuses?.join(","),
        from: filter?.from,
        to: filter?.to,
        search: filter?.search,
        page: 1,
        limit: 100,
      },
    });
    return resp.data.map(orderFromApi);
  }

  async get(id: ID): Promise<Order | null> {
    const session = apiCurrentSession();
    if (!session) return null;
    try {
      const dto = await apiFetch<OrderDTO>(`/stores/${session.storeId}/orders/${id}`);
      return orderFromApi(dto);
    } catch {
      return null;
    }
  }

  async getByNumber(_storeId: ID, _orderNumber: string): Promise<Order | null> {
    // Frontend uses this only on the customer confirmation page — we route
    // through the public endpoint (getPublicByNumber) so no auth is required.
    return null;
  }

  async create(_draft: OrderDraft): Promise<Order> {
    throw new Error("Use ApiOrderRepo.createPublic(slug, input) for customer checkout");
  }

  async createPublic(slug: string, input: PublicCreateOrderInput): Promise<Order> {
    const dto = await apiFetch<OrderDTO>(`/public/stores/${slug}/orders`, {
      method: "POST",
      body: input,
      anonymous: true,
    });
    emit("orders");
    return orderFromApi(dto);
  }

  async checkout(input: {
    storeSlug: string;
    customer: { name?: string; phone?: string };
    notes?: string;
    items: readonly { productId: string; quantity: number }[];
  }): Promise<Order> {
    return this.createPublic(input.storeSlug, {
      customer: input.customer,
      notes: input.notes,
      items: [...input.items],
    });
  }

  async getPublicByNumber(slug: string, orderNumber: string): Promise<Order | null> {
    try {
      const dto = await apiFetch<OrderDTO>(`/public/stores/${slug}/orders/${orderNumber}`, {
        anonymous: true,
      });
      return orderFromApi(dto);
    } catch {
      return null;
    }
  }

  async transition(id: ID, next: OrderStatus): Promise<Order> {
    const session = apiCurrentSession();
    if (!session) throw new Error("Not authenticated");
    const action = TRANSITION_TO_ACTION[next];
    if (!action) throw new Error(`Cannot transition to ${next}`);
    const dto = await apiFetch<OrderDTO>(
      `/stores/${session.storeId}/orders/${id}/${action}`,
      { method: "POST", body: {} },
    );
    emit("orders");
    return orderFromApi(dto);
  }

  async setPaymentStatus(_id: ID, _next: PaymentStatus): Promise<Order | null> {
    // Not needed on the frontend — payments are set server-side during order
    // creation. Included for interface parity.
    return null;
  }
}

const TRANSITION_TO_ACTION: Record<OrderStatus, string | undefined> = {
  NEW: undefined,
  ACCEPTED: "accept",
  PREPARING: "prepare",
  READY: "ready",
  COMPLETED: "complete",
  CANCELLED: "cancel",
};
