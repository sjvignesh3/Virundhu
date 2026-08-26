import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { API_ERROR_CODES, type ApiErrorBody } from "@virundhu/shared";
import { ApiException } from "../errors/api.exception";

/**
 * Uniform error envelope for every response. Maps:
 *   - ApiException        → its embedded ApiErrorBody (already well-formed)
 *   - HttpException       → generic { code, message } shape
 *   - Prisma errors       → conflict/not-found translations
 *   - Anything else       → 500 INTERNAL_ERROR (with server-side logging)
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const body = this.toBody(exception, req.url);
    res.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown, path: string): ApiErrorBody {
    const timestamp = new Date().toISOString();

    if (exception instanceof ApiException) {
      const inner = exception.getResponse() as ApiErrorBody;
      return { ...inner, timestamp, path };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.prismaToBody(exception, path, timestamp);
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const raw = exception.getResponse();
      const message =
        typeof raw === "string"
          ? raw
          : (raw as { message?: string | string[] }).message ?? exception.message;
      return {
        statusCode: status,
        code: this.codeForStatus(status),
        message: Array.isArray(message) ? message.join("; ") : message,
        details: typeof raw === "object" ? raw : undefined,
        timestamp,
        path,
      };
    }

    this.logger.error("Unhandled exception", exception as Error);
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: API_ERROR_CODES.INTERNAL_ERROR,
      message: "Something went wrong. Please try again.",
      timestamp,
      path,
    };
  }

  private prismaToBody(
    e: Prisma.PrismaClientKnownRequestError,
    path: string,
    timestamp: string,
  ): ApiErrorBody {
    // https://www.prisma.io/docs/reference/api-reference/error-reference
    if (e.code === "P2002") {
      return {
        statusCode: HttpStatus.CONFLICT,
        code: API_ERROR_CODES.CONFLICT,
        message: "A record with this value already exists.",
        details: e.meta,
        timestamp,
        path,
      };
    }
    if (e.code === "P2025") {
      return {
        statusCode: HttpStatus.NOT_FOUND,
        code: API_ERROR_CODES.NOT_FOUND,
        message: "Record not found.",
        details: e.meta,
        timestamp,
        path,
      };
    }
    if (e.code === "P2003") {
      return {
        statusCode: HttpStatus.CONFLICT,
        code: API_ERROR_CODES.CONFLICT,
        message: "Foreign key constraint failed.",
        details: e.meta,
        timestamp,
        path,
      };
    }
    // P2024 — connection pool exhausted (Render free tier / Supabase pgBouncer)
    if (e.code === "P2024") {
      this.logger.warn(`Prisma P2024 pool timeout: ${e.message}`);
      return {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        code: API_ERROR_CODES.INTERNAL_ERROR,
        message: "Server is busy. Please retry in a moment.",
        timestamp,
        path,
      };
    }
    this.logger.warn(`Unmapped Prisma error ${e.code}: ${e.message}`);
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: API_ERROR_CODES.INTERNAL_ERROR,
      message: "Database error.",
      timestamp,
      path,
    };
  }

  private codeForStatus(status: number): string {
    switch (status) {
      case HttpStatus.UNAUTHORIZED:
        return API_ERROR_CODES.UNAUTHENTICATED;
      case HttpStatus.FORBIDDEN:
        return API_ERROR_CODES.FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return API_ERROR_CODES.NOT_FOUND;
      case HttpStatus.CONFLICT:
        return API_ERROR_CODES.CONFLICT;
      case HttpStatus.BAD_REQUEST:
        return API_ERROR_CODES.VALIDATION_ERROR;
      default:
        return API_ERROR_CODES.INTERNAL_ERROR;
    }
  }
}
