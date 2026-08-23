import { PipeTransform, Injectable, ArgumentMetadata } from "@nestjs/common";
import { ZodSchema, ZodError } from "zod";
import { ApiException } from "../errors/api.exception";

/**
 * Bridges Zod schemas from @cartsas/shared into NestJS controllers.
 * Usage: `@Body(new ZodValidationPipe(createProductSchema)) input: CreateProductInput`
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown, _metadata: ArgumentMetadata): unknown {
    try {
      return this.schema.parse(value);
    } catch (err) {
      if (err instanceof ZodError) {
        throw ApiException.validation(
          "Validation failed",
          err.errors.map((e) => ({
            path: e.path.join("."),
            code: e.code,
            message: e.message,
          })),
        );
      }
      throw err;
    }
  }
}
