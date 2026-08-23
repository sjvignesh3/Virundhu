import { HttpException, HttpStatus } from "@nestjs/common";
import { API_ERROR_CODES, type ApiErrorCode, type ApiErrorBody } from "@cartsas/shared";

/**
 * Every business error thrown by services extends ApiException. The
 * GlobalExceptionFilter uses the embedded ApiErrorBody as the HTTP response,
 * so error codes stay consistent across the whole API.
 */
export class ApiException extends HttpException {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    status: HttpStatus,
    public readonly details?: unknown,
  ) {
    const body: ApiErrorBody = { statusCode: status, code, message, details };
    super(body, status);
  }

  static notFound(entity: string, id?: string): ApiException {
    return new ApiException(
      API_ERROR_CODES.NOT_FOUND,
      id ? `${entity} '${id}' not found` : `${entity} not found`,
      HttpStatus.NOT_FOUND,
    );
  }

  static conflict(message: string, details?: unknown): ApiException {
    return new ApiException(API_ERROR_CODES.CONFLICT, message, HttpStatus.CONFLICT, details);
  }

  static forbidden(message = "You do not have access to this resource"): ApiException {
    return new ApiException(API_ERROR_CODES.FORBIDDEN, message, HttpStatus.FORBIDDEN);
  }

  static unauth(message = "Authentication required"): ApiException {
    return new ApiException(API_ERROR_CODES.UNAUTHENTICATED, message, HttpStatus.UNAUTHORIZED);
  }

  static validation(message: string, details?: unknown): ApiException {
    return new ApiException(
      API_ERROR_CODES.VALIDATION_ERROR,
      message,
      HttpStatus.BAD_REQUEST,
      details,
    );
  }

  static invalidTransition(from: string, to: string): ApiException {
    return new ApiException(
      API_ERROR_CODES.INVALID_STATUS_TRANSITION,
      `Cannot move order from ${from} to ${to}`,
      HttpStatus.CONFLICT,
    );
  }

  static storeClosed(): ApiException {
    return new ApiException(
      API_ERROR_CODES.STORE_CLOSED,
      "Store is currently closed",
      HttpStatus.CONFLICT,
    );
  }

  static storeNotAccepting(): ApiException {
    return new ApiException(
      API_ERROR_CODES.STORE_NOT_ACCEPTING_ORDERS,
      "Store is not accepting orders right now",
      HttpStatus.CONFLICT,
    );
  }

  static productUnavailable(name: string): ApiException {
    return new ApiException(
      API_ERROR_CODES.PRODUCT_UNAVAILABLE,
      `${name} is currently unavailable`,
      HttpStatus.CONFLICT,
    );
  }

  static outOfStock(name: string): ApiException {
    return new ApiException(
      API_ERROR_CODES.PRODUCT_OUT_OF_STOCK,
      `${name} is out of stock`,
      HttpStatus.CONFLICT,
    );
  }

  static crossStore(): ApiException {
    return new ApiException(
      API_ERROR_CODES.CROSS_STORE_PRODUCT,
      "Product does not belong to this store",
      HttpStatus.BAD_REQUEST,
    );
  }

  static belowMinimum(min: number): ApiException {
    return new ApiException(
      API_ERROR_CODES.BELOW_MIN_ORDER,
      `Order total must be at least ₹${min}`,
      HttpStatus.CONFLICT,
    );
  }

  static emptyCart(): ApiException {
    return new ApiException(API_ERROR_CODES.EMPTY_CART, "Cart is empty", HttpStatus.BAD_REQUEST);
  }

  static categoryHasProducts(): ApiException {
    return new ApiException(
      API_ERROR_CODES.CATEGORY_HAS_PRODUCTS,
      "Cannot delete a category that still has products. Move or delete products first.",
      HttpStatus.CONFLICT,
    );
  }
}
