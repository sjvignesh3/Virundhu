/**
 * Supabase Storage image transform helper (Plan §4.3 + Performance Playbook).
 *
 * Menu photos live in the `store-media` bucket and are served through the
 * Supabase render endpoint. We resize on the edge to keep customer payloads
 * ≤60 KB webp per image, cutting egress by ~80% versus originals.
 *
 * The URL format Supabase exposes for signed/public objects is:
 *   /storage/v1/render/image/public/<bucket>/<path>?width=W&resize=cover
 *
 * We only rewrite URLs that clearly point at Supabase Storage; foreign URLs
 * (external Cloudinary, seed placeholders, etc.) pass through untouched.
 */

const TRANSFORM_MARKER = "/storage/v1/object/public/";
const RENDER_MARKER = "/storage/v1/render/image/public/";

export interface ImageOptions {
  /** Target width in pixels. Default 400 (product tile). */
  width?: number;
  /** Fit strategy. Default `cover` (crop to fill). */
  resize?: "cover" | "contain" | "fill";
  /**
   * When rendering above-the-fold hero images, set `quality=80` and consider
   * `format=origin` to preserve WebP when uploaded that way. Defaults are
   * tuned for thumbnail grids.
   */
  quality?: number;
}

export function transformImageUrl(url: string | null | undefined, opts: ImageOptions = {}): string | null {
  if (!url) return null;
  // Only rewrite Supabase public-object URLs.
  const idx = url.indexOf(TRANSFORM_MARKER);
  if (idx === -1) return url;

  const base = url.slice(0, idx) + RENDER_MARKER + url.slice(idx + TRANSFORM_MARKER.length);
  const params = new URLSearchParams();
  params.set("width", String(opts.width ?? 400));
  params.set("resize", opts.resize ?? "cover");
  if (opts.quality) params.set("quality", String(opts.quality));

  const sep = base.includes("?") ? "&" : "?";
  return base + sep + params.toString();
}
