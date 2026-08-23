/**
 * DTO ↔ frontend domain adapters.
 *
 * The frontend domain (`@/lib/domain/types`) is what the Phase 1 UI already
 * knows how to render. The API contract (`@cartsas/shared`) uses a slightly
 * flatter shape (Store separates settings, orders have a Customer relation
 * rather than an inline object, etc.). These adapters keep every UI
 * component untouched — the API repos read DTOs, run them through here,
 * and hand back familiar domain shapes.
 */

import type {
  CategoryDTO,
  OrderDTO,
  ProductDTO,
  PublicStoreDTO,
  StoreDTO,
  StoreSettingsDTO,
} from "@cartsas/shared";
import type {
  Category,
  Order,
  OrderItem,
  Product,
  Store,
} from "@/lib/domain/types";

export interface StoreWithSettings {
  store: StoreDTO;
  settings: StoreSettingsDTO;
}

function isStoreWithSettings(x: StoreWithSettings | PublicStoreDTO): x is StoreWithSettings {
  return typeof (x as { store?: unknown }).store === "object";
}

export function storeFromApi(input: StoreWithSettings | PublicStoreDTO): Store {
  const base: StoreDTO | PublicStoreDTO = isStoreWithSettings(input) ? input.store : input;
  const settings = input.settings;
  return {
    id: base.id,
    slug: base.slug,
    name: base.name,
    tamilName: base.tamilName ?? undefined,
    description: base.description ?? undefined,
    phone: base.phone ?? undefined,
    address: base.address ?? undefined,
    status: base.status,
    minOrderValue: settings.minimumOrderValue,
    prepTimeMinutes: settings.estimatedPreparationMinutes,
    language: settings.defaultLanguage,
    showTamilNames: settings.showTamilNames,
    showUnavailable: settings.showUnavailable,
    logo: base.logoUrl ?? undefined,
    createdAt: "createdAt" in base ? base.createdAt : new Date().toISOString(),
    updatedAt: "updatedAt" in base ? base.updatedAt : new Date().toISOString(),
  };
}

export function categoryFromApi(c: CategoryDTO): Category {
  return {
    id: c.id,
    storeId: c.storeId,
    name: c.name,
    tamilName: c.tamilName ?? undefined,
    sortOrder: c.displayOrder,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

export function productFromApi(p: ProductDTO): Product {
  return {
    id: p.id,
    storeId: p.storeId,
    categoryId: p.categoryId,
    name: p.name,
    tamilName: p.tamilName ?? undefined,
    description: p.description ?? undefined,
    tamilDescription: p.tamilDescription ?? undefined,
    price: p.price,
    unit: p.unit,
    image: p.imageUrl ?? undefined,
    available: p.isAvailable,
    lowStockThreshold: p.lowStockThreshold ?? undefined,
    stock: p.stockQuantity ?? undefined,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

export function orderFromApi(o: OrderDTO): Order {
  const items: OrderItem[] = o.items.map((i) => ({
    productId: i.productId ?? "",
    name: i.productName,
    tamilName: i.productTamilName ?? undefined,
    unit: i.unit,
    unitPrice: i.unitPrice,
    quantity: i.quantity,
    lineTotal: i.subtotal,
  }));
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    storeId: o.storeId,
    customer: {
      name: o.customer?.name ?? undefined,
      phone: o.customer?.phone ?? undefined,
      note: o.notes ?? undefined,
    },
    items,
    subtotal: o.subtotal,
    total: o.totalAmount,
    paymentMethod: o.paymentMethod === "SIMULATED" ? "SIMULATED" : o.paymentMethod === "CASH" ? "CASH" : "UPI",
    paymentStatus: o.paymentStatus === "PAID" ? "PAID" : o.paymentStatus === "FAILED" ? "FAILED" : "PENDING",
    status: o.status,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    completedAt: o.completedAt ?? undefined,
  };
}
