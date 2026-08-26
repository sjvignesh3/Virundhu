/**
 * Standard API error envelope. Backend returns this shape from its exception
 * filter; frontend normalizes fetch errors into the same shape. UI code only
 * needs to handle one type.
 */

export interface ApiErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
  timestamp?: string;
  path?: string;
}

export const API_ERROR_CODES = {
  // Auth
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  UNAUTHENTICATED: "UNAUTHENTICATED",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  EMAIL_TAKEN: "EMAIL_TAKEN",
  EMAIL_NOT_VERIFIED: "EMAIL_NOT_VERIFIED",
  RATE_LIMITED: "RATE_LIMITED",

  // Validation
  VALIDATION_ERROR: "VALIDATION_ERROR",
  BAD_REQUEST: "BAD_REQUEST",

  // Resources
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",

  // Order flow
  STORE_CLOSED: "STORE_CLOSED",
  STORE_NOT_ACCEPTING_ORDERS: "STORE_NOT_ACCEPTING_ORDERS",
  EMPTY_CART: "EMPTY_CART",
  PRODUCT_UNAVAILABLE: "PRODUCT_UNAVAILABLE",
  PRODUCT_OUT_OF_STOCK: "PRODUCT_OUT_OF_STOCK",
  CROSS_STORE_PRODUCT: "CROSS_STORE_PRODUCT",
  BELOW_MIN_ORDER: "BELOW_MIN_ORDER",
  INVALID_STATUS_TRANSITION: "INVALID_STATUS_TRANSITION",
  INVALID_ORDER_TRANSITION: "INVALID_STATUS_TRANSITION",
  PAYMENT_FAILED: "PAYMENT_FAILED",

  // Category safety
  CATEGORY_HAS_PRODUCTS: "CATEGORY_HAS_PRODUCTS",

  // Fallback
  INTERNAL: "INTERNAL_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];

export class ApiError extends Error {
  constructor(
    public readonly body: ApiErrorBody,
    public readonly status: number = body.statusCode,
  ) {
    super(body.message);
    this.name = "ApiError";
  }

  get code(): string {
    return this.body.code;
  }
}
