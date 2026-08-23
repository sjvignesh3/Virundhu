/**
 * Zod schemas — reused by:
 *   - NestJS backend as a ZodValidationPipe on every controller
 *   - Next.js frontend for form validation (React Hook Form + zodResolver)
 *
 * Keeping one contract on both sides guarantees frontend and backend stay
 * in lock-step. Any change here surfaces as a type error in both apps.
 */

import { z } from "zod";
import {
  LANGUAGES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  PRINTER_CONNECTION_STATUSES,
  PRINTER_TYPES,
  STORE_ROLES,
  STORE_STATUSES,
  UNITS,
} from "./enums";

const trimmedString = (min = 1, max = 200) =>
  z.string().trim().min(min).max(max);

const optionalTrimmed = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v === "" ? undefined : v));

const money = z
  .number()
  .finite()
  .nonnegative()
  .max(1_000_000, "Amount exceeds sensible limit");

// -- Auth ---------------------------------------------------------------------

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(6).max(72),
});
export type LoginInput = z.infer<typeof loginSchema>;

// -- Store --------------------------------------------------------------------

export const storeSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(50)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be kebab-case (a-z, 0-9, -)");

// -- Signup (owner + store, single transaction) -------------------------------

/**
 * A brand-new owner signs up by providing:
 *   - Their identity + password
 *   - A minimal store bootstrap (name + slug)
 *
 * The backend creates the User, Store, StoreUser (OWNER), StoreSettings, and
 * OrderSequence rows in ONE transaction. No categories, products, or demo
 * orders are seeded — new accounts start with a clean slate.
 */
export const signupSchema = z.object({
  // Owner identity
  name: trimmedString(1, 120),
  email: z.string().trim().toLowerCase().email(),
  phone: optionalTrimmed(30),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72)
    .regex(/[A-Za-z]/, "Password must contain at least one letter")
    .regex(/[0-9]/, "Password must contain at least one number"),

  // Store bootstrap
  storeName: trimmedString(1, 120),
  storeSlug: storeSlugSchema,
  storeTamilName: optionalTrimmed(120),
  storeDescription: optionalTrimmed(1000),
  storePhone: optionalTrimmed(30),
  storeAddress: optionalTrimmed(300),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const createStoreSchema = z.object({
  slug: storeSlugSchema,
  name: trimmedString(1, 120),
  tamilName: optionalTrimmed(120),
  description: optionalTrimmed(1000),
  phone: optionalTrimmed(30),
  address: optionalTrimmed(300),
  logoUrl: optionalTrimmed(500),
  imageUrl: optionalTrimmed(500),
  status: z.enum(STORE_STATUSES).default("OPEN"),
});
export type CreateStoreInput = z.infer<typeof createStoreSchema>;

export const updateStoreSchema = createStoreSchema.partial();
export type UpdateStoreInput = z.infer<typeof updateStoreSchema>;

// -- Store settings -----------------------------------------------------------

export const updateStoreSettingsSchema = z.object({
  defaultLanguage: z.enum(LANGUAGES).optional(),
  showTamilNames: z.boolean().optional(),
  showUnavailable: z.boolean().optional(),
  acceptOrders: z.boolean().optional(),
  minimumOrderValue: money.optional(),
  estimatedPreparationMinutes: z.number().int().min(0).max(600).optional(),
});
export type UpdateStoreSettingsInput = z.infer<typeof updateStoreSettingsSchema>;

// -- Category -----------------------------------------------------------------

export const createCategorySchema = z.object({
  name: trimmedString(1, 80),
  tamilName: optionalTrimmed(80),
  description: optionalTrimmed(500),
  displayOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = createCategorySchema.partial();
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

// -- Product ------------------------------------------------------------------

export const createProductSchema = z.object({
  categoryId: z.string().uuid(),
  name: trimmedString(1, 120),
  tamilName: optionalTrimmed(120),
  description: optionalTrimmed(1000),
  tamilDescription: optionalTrimmed(1000),
  price: money,
  unit: z.enum(UNITS),
  imageUrl: optionalTrimmed(500),
  isAvailable: z.boolean().default(true),
  stockQuantity: z.number().finite().min(0).nullable().optional(),
  lowStockThreshold: z.number().finite().min(0).nullable().optional(),
  displayOrder: z.number().int().min(0).default(0),
});
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = createProductSchema.partial();
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const setProductAvailabilitySchema = z.object({
  isAvailable: z.boolean(),
});

// -- Customer order (public) --------------------------------------------------

export const publicCartLineSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(999),
});

export const publicCreateOrderSchema = z.object({
  customer: z
    .object({
      name: optionalTrimmed(100),
      phone: optionalTrimmed(30),
    })
    .default({}),
  notes: optionalTrimmed(500),
  items: z.array(publicCartLineSchema).min(1, "Cart cannot be empty"),
});
export type PublicCreateOrderInput = z.infer<typeof publicCreateOrderSchema>;

// -- Order transitions --------------------------------------------------------

export const orderTransitionSchema = z.object({
  note: optionalTrimmed(300),
});
export type OrderTransitionInput = z.infer<typeof orderTransitionSchema>;

// -- Order queries ------------------------------------------------------------

export const orderListQuerySchema = z.object({
  status: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",") : undefined)),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
});
export type OrderListQuery = z.infer<typeof orderListQuerySchema>;

// -- Printer ------------------------------------------------------------------

export const createPrinterSchema = z.object({
  name: trimmedString(1, 80),
  type: z.enum(PRINTER_TYPES),
  address: optionalTrimmed(200),
  isActive: z.boolean().default(true),
  connectionStatus: z.enum(PRINTER_CONNECTION_STATUSES).default("UNKNOWN"),
});
export type CreatePrinterInput = z.infer<typeof createPrinterSchema>;

export const updatePrinterSchema = createPrinterSchema.partial();
export type UpdatePrinterInput = z.infer<typeof updatePrinterSchema>;

// -- Payment override (admin/simulated) ---------------------------------------

export const paymentSchema = z.object({
  method: z.enum(PAYMENT_METHODS).default("SIMULATED"),
  status: z.enum(PAYMENT_STATUSES).default("PAID"),
});

// -- Store user (owner-adds-member) -------------------------------------------

export const addStoreUserSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(STORE_ROLES).default("STAFF"),
});
