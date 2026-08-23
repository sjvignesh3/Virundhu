/**
 * Core domain types for the Food Cart SaaS.
 *
 * Conventions:
 * - All ids are opaque strings (UUIDs in practice).
 * - All monetary values are integers in INR (no paise). Simpler math, no float bugs.
 * - All timestamps are ISO 8601 strings for JSON-safety in localStorage.
 * - Tamil fields are optional; UI decides whether to show them via `Store.showTamilNames`.
 */

// -- Primitives ---------------------------------------------------------------

export type ID = string;
export type ISODateString = string;

export type Unit = 'plate' | 'piece' | 'cup' | 'glass' | 'bottle' | 'kg' | 'g';

export type Language = 'en' | 'ta';

export type StoreStatus = 'OPEN' | 'CLOSED';

export type OrderStatus =
  | 'NEW'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY'
  | 'COMPLETED'
  | 'CANCELLED';

export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED';

export type PaymentMethod = 'SIMULATED' | 'CASH' | 'UPI';

// -- Entities -----------------------------------------------------------------

export interface Store {
  id: ID;
  slug: string;
  name: string;
  tamilName?: string;
  description?: string;
  phone?: string;
  address?: string;
  status: StoreStatus;
  minOrderValue?: number;
  prepTimeMinutes?: number;
  language: Language;
  showTamilNames: boolean;
  showUnavailable: boolean;
  logo?: string;
  accent?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface Category {
  id: ID;
  storeId: ID;
  name: string;
  tamilName?: string;
  sortOrder: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface Product {
  id: ID;
  storeId: ID;
  categoryId: ID;
  name: string;
  tamilName?: string;
  description?: string;
  tamilDescription?: string;
  price: number;
  unit: Unit;
  image?: string;
  available: boolean;
  lowStockThreshold?: number;
  stock?: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface OrderItem {
  productId: ID;
  name: string;
  tamilName?: string;
  unit: Unit;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface Customer {
  name?: string;
  phone?: string;
  note?: string;
}

export interface Order {
  id: ID;
  orderNumber: string;
  storeId: ID;
  customer: Customer;
  items: OrderItem[];
  subtotal: number;
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  completedAt?: ISODateString;
}

// -- Draft / input shapes -----------------------------------------------------
// Used by repositories: caller provides business fields, repo assigns id + timestamps.

export type CategoryDraft = Omit<Category, 'id' | 'createdAt' | 'updatedAt'>;
export type ProductDraft = Omit<Product, 'id' | 'createdAt' | 'updatedAt'>;
export type StoreDraft = Omit<Store, 'id' | 'createdAt' | 'updatedAt'>;
export type OrderDraft = Omit<
  Order,
  'id' | 'orderNumber' | 'createdAt' | 'updatedAt' | 'completedAt'
>;
