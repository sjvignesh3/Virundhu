/**
 * Prisma row → wire DTO mappers.
 *
 * These are the *only* place Prisma types cross into the API layer. All
 * controllers/services should return DTOs by running rows through these,
 * so the wire contract in @virundhu/shared/types.ts is authoritative.
 */

import type {
  Category as PCategory,
  Customer as PCustomer,
  Order as POrder,
  OrderItem as POrderItem,
  OrderStatusHistory as POrderStatusHistory,
  Payment as PPayment,
  Printer as PPrinter,
  Product as PProduct,
  Store as PStore,
  StoreSettings as PStoreSettings,
  StoreUser as PStoreUser,
  User as PUser,
} from "@prisma/client";
import type {
  CategoryDTO,
  CustomerDTO,
  OrderDTO,
  OrderItemDTO,
  OrderStatusHistoryDTO,
  PaymentDTO,
  PrinterDTO,
  ProductDTO,
  PublicStoreDTO,
  StoreDTO,
  StoreMembershipDTO,
  StoreSettingsDTO,
  UserDTO,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  PaymentProvider,
  PrinterConnectionStatus,
  PrinterType,
  Language,
  StoreRole,
  StoreStatus,
  Unit,
} from "@virundhu/shared";
import { decimalToNumber, optionalDecimalToNumber } from "./decimal";

const iso = (d: Date): string => d.toISOString();
const isoOrNull = (d: Date | null): string | null => (d ? d.toISOString() : null);

export function toUserDTO(u: PUser): UserDTO {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    isActive: u.isActive,
    createdAt: iso(u.createdAt),
    updatedAt: iso(u.updatedAt),
  };
}

export function toStoreDTO(s: PStore): StoreDTO {
  return {
    id: s.id,
    slug: s.slug,
    name: s.name,
    tamilName: s.tamilName,
    description: s.description,
    phone: s.phone,
    address: s.address,
    logoUrl: s.logoUrl,
    imageUrl: s.imageUrl,
    status: s.status as StoreStatus,
    createdAt: iso(s.createdAt),
    updatedAt: iso(s.updatedAt),
  };
}

export function toStoreSettingsDTO(s: PStoreSettings): StoreSettingsDTO {
  return {
    id: s.id,
    storeId: s.storeId,
    defaultLanguage: s.defaultLanguage as Language,
    showTamilNames: s.showTamilNames,
    showUnavailable: s.showUnavailable,
    acceptOrders: s.acceptOrders,
    minimumOrderValue: decimalToNumber(s.minimumOrderValue),
    estimatedPreparationMinutes: s.estimatedPreparationMinutes,
    createdAt: iso(s.createdAt),
    updatedAt: iso(s.updatedAt),
  };
}

export function toPublicStoreDTO(s: PStore, settings: PStoreSettings): PublicStoreDTO {
  return {
    id: s.id,
    slug: s.slug,
    name: s.name,
    tamilName: s.tamilName,
    description: s.description,
    phone: s.phone,
    address: s.address,
    logoUrl: s.logoUrl,
    imageUrl: s.imageUrl,
    status: s.status as StoreStatus,
    settings: {
      defaultLanguage: settings.defaultLanguage as Language,
      showTamilNames: settings.showTamilNames,
      showUnavailable: settings.showUnavailable,
      acceptOrders: settings.acceptOrders,
      minimumOrderValue: decimalToNumber(settings.minimumOrderValue),
      estimatedPreparationMinutes: settings.estimatedPreparationMinutes,
    },
  };
}

export function toCategoryDTO(c: PCategory): CategoryDTO {
  return {
    id: c.id,
    storeId: c.storeId,
    name: c.name,
    tamilName: c.tamilName,
    description: c.description,
    displayOrder: c.displayOrder,
    isActive: c.isActive,
    createdAt: iso(c.createdAt),
    updatedAt: iso(c.updatedAt),
  };
}

export function toProductDTO(p: PProduct): ProductDTO {
  return {
    id: p.id,
    storeId: p.storeId,
    categoryId: p.categoryId,
    name: p.name,
    tamilName: p.tamilName,
    description: p.description,
    tamilDescription: p.tamilDescription,
    price: decimalToNumber(p.price),
    unit: p.unit as Unit,
    imageUrl: p.imageUrl,
    isAvailable: p.isAvailable,
    stockQuantity: optionalDecimalToNumber(p.stockQuantity),
    lowStockThreshold: optionalDecimalToNumber(p.lowStockThreshold),
    displayOrder: p.displayOrder,
    createdAt: iso(p.createdAt),
    updatedAt: iso(p.updatedAt),
  };
}

export function toCustomerDTO(c: PCustomer): CustomerDTO {
  return {
    id: c.id,
    storeId: c.storeId,
    name: c.name,
    phone: c.phone,
    createdAt: iso(c.createdAt),
    updatedAt: iso(c.updatedAt),
  };
}

export function toOrderItemDTO(i: POrderItem): OrderItemDTO {
  return {
    id: i.id,
    orderId: i.orderId,
    productId: i.productId,
    productName: i.productName,
    productTamilName: i.productTamilName,
    unit: i.unit as Unit,
    unitPrice: decimalToNumber(i.unitPrice),
    quantity: decimalToNumber(i.quantity),
    subtotal: decimalToNumber(i.subtotal),
    createdAt: iso(i.createdAt),
  };
}

export function toOrderDTO(
  o: POrder & { items: POrderItem[]; customer?: PCustomer | null },
): OrderDTO {
  return {
    id: o.id,
    storeId: o.storeId,
    customerId: o.customerId,
    orderNumber: o.orderNumber,
    status: o.status as OrderStatus,
    paymentStatus: o.paymentStatus as PaymentStatus,
    paymentMethod: o.paymentMethod as PaymentMethod,
    subtotal: decimalToNumber(o.subtotal),
    discountAmount: decimalToNumber(o.discountAmount),
    taxAmount: decimalToNumber(o.taxAmount),
    totalAmount: decimalToNumber(o.totalAmount),
    notes: o.notes,
    createdAt: iso(o.createdAt),
    updatedAt: iso(o.updatedAt),
    completedAt: isoOrNull(o.completedAt),
    cancelledAt: isoOrNull(o.cancelledAt),
    items: o.items.map(toOrderItemDTO),
    customer: o.customer ? toCustomerDTO(o.customer) : null,
  };
}

export function toPaymentDTO(p: PPayment): PaymentDTO {
  return {
    id: p.id,
    orderId: p.orderId,
    provider: p.provider as PaymentProvider,
    providerPaymentId: p.providerPaymentId,
    method: p.method as PaymentMethod,
    status: p.status as PaymentStatus,
    amount: decimalToNumber(p.amount),
    createdAt: iso(p.createdAt),
    updatedAt: iso(p.updatedAt),
  };
}

export function toOrderStatusHistoryDTO(h: POrderStatusHistory): OrderStatusHistoryDTO {
  return {
    id: h.id,
    orderId: h.orderId,
    fromStatus: (h.fromStatus as OrderStatus | null) ?? null,
    toStatus: h.toStatus as OrderStatus,
    changedByUserId: h.changedByUserId,
    note: h.note,
    createdAt: iso(h.createdAt),
  };
}

export function toPrinterDTO(p: PPrinter): PrinterDTO {
  return {
    id: p.id,
    storeId: p.storeId,
    name: p.name,
    type: p.type as PrinterType,
    connectionStatus: p.connectionStatus as PrinterConnectionStatus,
    address: p.address,
    isActive: p.isActive,
    createdAt: iso(p.createdAt),
    updatedAt: iso(p.updatedAt),
  };
}

export function toStoreMembershipDTO(m: PStoreUser & { store: PStore }): StoreMembershipDTO {
  return {
    storeId: m.storeId,
    role: m.role as StoreRole,
    store: toStoreDTO(m.store),
  };
}
