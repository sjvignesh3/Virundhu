/**
 * Public menu repo — anonymous read of a store's catalogue.
 *
 * Two fetch paths (chosen at runtime by env):
 *
 *   1. Edge-cached proxy  (default, prod + Vercel dev)
 *      GET <publicMenuBaseUrl>/:slug   →  /api/menu/:slug
 *      Served by `apps/spa/api/menu/[slug].ts` with
 *      `Cache-Control: public, max-age=60, s-maxage=300, stale-while-revalidate=86400`.
 *      99% of Chennai visitors hit the Vercel Edge in <50ms with zero DB load.
 *
 *   2. Direct Supabase view  (fallback)
 *      Used when `VITE_PUBLIC_MENU_BASE_URL=""`. Handy for local `vite dev`
 *      without a Vercel dev server, unit tests, and the Playwright suite.
 *
 * Contract is identical either way — { slug, store, categories }.
 */
import { getSupabase } from "../supabase";
import { getSupabaseEnv } from "../env";
import { ClientApiError, fromPostgrest } from "../errors";
import { API_ERROR_CODES } from "@virundhu/shared";

export interface PublicMenuStore {
  id: string;
  slug: string;
  name: string;
  tamilName: string | null;
  description: string | null;
  phone: string | null;
  address: string | null;
  logoUrl: string | null;
  imageUrl: string | null;
  status: "OPEN" | "CLOSED";
  settings: {
    defaultLanguage: "en" | "ta";
    showTamilNames: boolean;
    showUnavailable: boolean;
    acceptOrders: boolean;
    minimumOrderValue: number;
    estimatedPreparationMinutes: number;
  };
}

export interface PublicMenuProduct {
  id: string;
  name: string;
  tamilName: string | null;
  description: string | null;
  tamilDescription: string | null;
  price: number;
  unit: string;
  imageUrl: string | null;
  stockQuantity: number | null;
  isAvailable: boolean;
  displayOrder: number;
}

export interface PublicMenuCategory {
  id: string;
  name: string;
  tamilName: string | null;
  description: string | null;
  displayOrder: number;
  products: PublicMenuProduct[];
}

export interface PublicMenu {
  slug: string;
  store: PublicMenuStore;
  categories: PublicMenuCategory[];
}

async function fetchViaEdgeProxy(baseUrl: string, slug: string): Promise<PublicMenu> {
  const res = await fetch(`${baseUrl}/${encodeURIComponent(slug)}`, {
    method: "GET",
    headers: { accept: "application/json" },
  });
  if (res.status === 404) {
    throw new ClientApiError(API_ERROR_CODES.NOT_FOUND, "Menu not found", 404);
  }
  if (!res.ok) {
    throw new ClientApiError(
      API_ERROR_CODES.INTERNAL_ERROR,
      `Menu proxy responded ${res.status}`,
      res.status,
    );
  }
  return (await res.json()) as PublicMenu;
}

async function fetchViaSupabase(slug: string): Promise<PublicMenu> {
  const { data, error } = await getSupabase()
    .from("public_store_menu")
    .select("slug, store, categories")
    .eq("slug", slug)
    .single();
  if (error) throw fromPostgrest(error);
  return data as unknown as PublicMenu;
}

export interface PublicOrderReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface PublicOrderReceipt {
  orderNumber: string;
  status: string;
  paymentStatus: string;
  subtotal: number;
  tax: number;
  total: number;
  placedAt: string;
  items: PublicOrderReceiptItem[];
}

export const publicMenuRepo = {
  async bySlug(slug: string): Promise<PublicMenu> {
    const { publicMenuBaseUrl } = getSupabaseEnv();
    if (publicMenuBaseUrl && publicMenuBaseUrl.length > 0) {
      return fetchViaEdgeProxy(publicMenuBaseUrl, slug);
    }
    return fetchViaSupabase(slug);
  },

  /**
   * Anonymous receipt lookup used by the success page. Backed by the
   * `public_order_lookup(slug, order_no)` RPC — the `orders` table itself
   * is denied to anon by RLS.
   */
  async lookupOrder(slug: string, orderNumber: string): Promise<PublicOrderReceipt> {
    const { data, error } = await getSupabase().rpc("public_order_lookup", {
      p_slug: slug,
      p_order_number: orderNumber,
    });
    if (error) throw fromPostgrest(error);
    return data as unknown as PublicOrderReceipt;
  },
};
