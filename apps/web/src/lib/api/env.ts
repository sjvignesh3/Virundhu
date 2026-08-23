/**
 * Runtime configuration for the API client. Reads NEXT_PUBLIC_API_URL when
 * present (works in both SSR and the browser); falls back to :4000 in dev.
 */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:4000/api";

export const AUTH_STORAGE_KEY = "cartsas:v2:auth";

export interface AuthSession {
  accessToken: string;
  userId: string;
  email: string;
  storeId: string;
  storeSlug: string;
}
