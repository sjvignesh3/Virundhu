/**
 * @cartsas/shared — API contract shared by @cartsas/web and @cartsas/api.
 *
 * Everything exported here is safe on both server and client (no Node-only
 * deps, no React deps). Keep it small and dependency-free apart from Zod.
 */

export * from "./enums";
export * from "./types";
export * from "./schemas";
export * from "./api-errors";
export * from "./transitions";
export * from "./totals";
