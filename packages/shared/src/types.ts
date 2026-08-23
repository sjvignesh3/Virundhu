/**
 * Wire types — the JSON shape of every entity as it crosses the API boundary.
 *
 * Rules:
 * - Money is `number` in INR rupees (integers preferred; Decimal → number
 *   conversion happens in the API serializer).
 * - Timestamps are ISO 8601 strings.
 * - IDs are UUID strings.
 * - No Prisma types leak here; API DTOs derive their shape from this file.
 */

import type {
  Language,
  OrderStatus,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
  PrinterConnectionStatus,
  PrinterType,
  StoreRole,
  StoreStatus,
  Unit,
} from "./enums";

export type ID = string;
export type ISODateString = string;

export interface StoreDTO {
  id: ID;
  slug: string;
  name: string;
  tamilName?: string | null;
  description?: string | null;
  phone?: string | null;
  address?: string | null;
  logoUrl?: string | null;
  imageUrl?: string | null;
  status: StoreStatus;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface StoreSettingsDTO {
  id: ID;
  storeId: ID;
  defaultLanguage: Language;
  showTamilNames: boolean;
  showUnavailable: boolean;
  acceptOrders: boolean;
  minimumOrderValue: number;
  estimatedPreparationMinutes: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/** Public store shape returned to unauthenticated customer clients. */
export interface PublicStoreDTO
  extends Pick<
    StoreDTO,
    "id" | "slug" | "name" | "tamilName" | "description" | "phone" | "address" | "logoUrl" | "imageUrl" | "status"
  > {
  settings: Pick<
    StoreSettingsDTO,
    "defaultLanguage" | "showTamilNames" | "showUnavailable" | "acceptOrders" | "minimumOrderValue" | "estimatedPreparationMinutes"
  >;
}

export interface CategoryDTO {
  id: ID;
  storeId: ID;
  name: string;
  tamilName?: string | null;
  description?: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface ProductDTO {
  id: ID;
  storeId: ID;
  categoryId: ID;
  name: string;
  tamilName?: string | null;
  description?: string | null;
  tamilDescription?: string | null;
  price: number;
  unit: Unit;
  imageUrl?: string | null;
  isAvailable: boolean;
  stockQuantity: number | null;
  lowStockThreshold: number | null;
  displayOrder: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface CustomerDTO {
  id: ID;
  storeId: ID;
  name?: string | null;
  phone?: string | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface OrderItemDTO {
  id: ID;
  orderId: ID;
  productId: ID | null;
  productName: string;
  productTamilName?: string | null;
  unit: Unit;
  unitPrice: number;
  quantity: number;
  subtotal: number;
  createdAt: ISODateString;
}

export interface OrderDTO {
  id: ID;
  storeId: ID;
  customerId: ID | null;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  notes?: string | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  completedAt?: ISODateString | null;
  cancelledAt?: ISODateString | null;
  items: OrderItemDTO[];
  customer?: CustomerDTO | null;
}

export interface PaymentDTO {
  id: ID;
  orderId: ID;
  provider: PaymentProvider;
  providerPaymentId?: string | null;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface OrderStatusHistoryDTO {
  id: ID;
  orderId: ID;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  changedByUserId?: ID | null;
  note?: string | null;
  createdAt: ISODateString;
}

export interface PrinterDTO {
  id: ID;
  storeId: ID;
  name: string;
  type: PrinterType;
  connectionStatus: PrinterConnectionStatus;
  address?: string | null;
  isActive: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface UserDTO {
  id: ID;
  name: string;
  email: string;
  phone?: string | null;
  isActive: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface StoreMembershipDTO {
  storeId: ID;
  role: StoreRole;
  store: StoreDTO;
}

export interface AuthLoginResponse {
  accessToken: string;
  user: UserDTO;
  memberships: StoreMembershipDTO[];
}

// -- Aggregate DTOs -----------------------------------------------------------

export interface DashboardMetricsDTO {
  ordersToday: number;
  completedToday: number;
  activeOrders: number;
  revenueToday: number;
  totalProducts: number;
  availableProducts: number;
  lowStockCount: number;
  outOfStockCount: number;
  categoryCount: number;
  topItems: Array<{ productId: ID | null; name: string; quantity: number }>;
}

export interface ReportsSummaryDTO {
  range: { from: ISODateString; to: ISODateString };
  ordersCount: number;
  completedCount: number;
  cancelledCount: number;
  revenue: number;
  averageOrderValue: number;
  statusBreakdown: Record<OrderStatus, number>;
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
