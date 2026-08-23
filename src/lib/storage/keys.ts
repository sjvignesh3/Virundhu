/**
 * All localStorage keys used by the app.
 *
 * Every key is prefixed with `cartsas:v1:` so:
 *   1. We never collide with anything else on `localhost`.
 *   2. A future schema change bumps the version segment (`v2`) and a migration
 *      module can transform old data (or wipe it) without touching consumers.
 */

const NS = "cartsas:v1";

export const STORAGE_KEYS = {
  stores: `${NS}:stores`,
  categories: `${NS}:categories`,
  products: `${NS}:products`,
  orders: `${NS}:orders`,
  orderSeq: `${NS}:orderSeq`, // { [storeId]: number }
  seeded: `${NS}:seeded`,
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
