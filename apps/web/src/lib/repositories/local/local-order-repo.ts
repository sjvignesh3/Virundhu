import type {
  ID,
  Order,
  OrderDraft,
  OrderStatus,
  PaymentStatus,
} from "@/lib/domain/types";
import { newId, now } from "@/lib/domain/ids";
import { canTransition } from "@/lib/domain/order-status";
import { generateOrderNumber } from "@/lib/domain/order-number";
import { readCollection, readJSON, writeCollection, writeJSON } from "@/lib/storage/local-storage";
import { emit } from "@/lib/storage/event-bus";
import { STORAGE_KEYS } from "@/lib/storage/keys";
import type { OrderRepo, OrderListFilter } from "../types";

const KEY = STORAGE_KEYS.orders;
const SEQ_KEY = STORAGE_KEYS.orderSeq;

export class InvalidTransitionError extends Error {
  constructor(from: OrderStatus, to: OrderStatus) {
    super(`Invalid order status transition: ${from} → ${to}`);
    this.name = "InvalidTransitionError";
  }
}

type SeqMap = Record<ID, number>;

function nextSeq(storeId: ID): number {
  const map = readJSON<SeqMap>(SEQ_KEY, {});
  const current = map[storeId] ?? 0;
  const next = current + 1;
  map[storeId] = next;
  writeJSON(SEQ_KEY, map);
  return next;
}

export class LocalOrderRepo implements OrderRepo {
  async list(storeId: ID, filter?: OrderListFilter): Promise<Order[]> {
    let list = readCollection<Order>(KEY).filter((o) => o.storeId === storeId);

    if (filter?.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      const set = new Set(statuses);
      list = list.filter((o) => set.has(o.status));
    }
    if (filter?.from) {
      list = list.filter((o) => o.createdAt >= filter.from!);
    }
    if (filter?.to) {
      list = list.filter((o) => o.createdAt <= filter.to!);
    }
    if (filter?.search) {
      const q = filter.search.trim().toLowerCase();
      if (q) {
        list = list.filter(
          (o) =>
            o.orderNumber.toLowerCase().includes(q) ||
            (o.customer.name?.toLowerCase().includes(q) ?? false) ||
            (o.customer.phone?.toLowerCase().includes(q) ?? false),
        );
      }
    }
    // Newest first — matches history + live board expectations.
    return list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  async get(id: ID): Promise<Order | null> {
    return readCollection<Order>(KEY).find((o) => o.id === id) ?? null;
  }

  async getByNumber(storeId: ID, orderNumber: string): Promise<Order | null> {
    return (
      readCollection<Order>(KEY).find(
        (o) => o.storeId === storeId && o.orderNumber === orderNumber,
      ) ?? null
    );
  }

  async create(draft: OrderDraft): Promise<Order> {
    const list = readCollection<Order>(KEY);
    const ts = now();
    const seq = nextSeq(draft.storeId);
    const order: Order = {
      ...draft,
      id: newId(),
      orderNumber: generateOrderNumber(seq),
      createdAt: ts,
      updatedAt: ts,
    };
    list.push(order);
    writeCollection(KEY, list);
    emit("orders");
    return order;
  }

  async transition(id: ID, next: OrderStatus): Promise<Order> {
    const list = readCollection<Order>(KEY);
    const idx = list.findIndex((o) => o.id === id);
    if (idx === -1) throw new Error(`Order not found: ${id}`);
    const current = list[idx];
    if (!canTransition(current.status, next)) {
      throw new InvalidTransitionError(current.status, next);
    }
    const ts = now();
    const updated: Order = {
      ...current,
      status: next,
      updatedAt: ts,
      completedAt: next === "COMPLETED" ? ts : current.completedAt,
    };
    list[idx] = updated;
    writeCollection(KEY, list);
    emit("orders");
    return updated;
  }

  async setPaymentStatus(id: ID, next: PaymentStatus): Promise<Order | null> {
    const list = readCollection<Order>(KEY);
    const idx = list.findIndex((o) => o.id === id);
    if (idx === -1) return null;
    const updated: Order = { ...list[idx], paymentStatus: next, updatedAt: now() };
    list[idx] = updated;
    writeCollection(KEY, list);
    emit("orders");
    return updated;
  }
}
