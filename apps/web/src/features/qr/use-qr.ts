"use client";

/**
 * Reusable QR generation hook.
 *
 * Per Requirements §15 the QR logic must be reusable by Dashboard, Settings,
 * the modal, and the printable poster — so it lives here, decoupled from any
 * UI surface. Wraps `qrcode.toDataURL` with sane defaults, guards against
 * setState-after-unmount, and normalises errors.
 */

import * as React from "react";
import QRCode from "qrcode";

export interface UseQrOptions {
  /** Pixel size of the PNG. Default 512 — high enough for print. */
  width?: number;
  /** Quiet-zone margin in modules. Default 2. */
  margin?: number;
  /**
   * Error-correction level. "M" tolerates ~15% damage; bump to "H" for
   * outdoor / stall-sticker use where the QR gets scuffed.
   */
  errorCorrectionLevel?: "L" | "M" | "Q" | "H";
  /** Foreground colour (dark modules). Default deep slate. */
  dark?: string;
  /** Background colour. Default white. */
  light?: string;
}

export interface UseQrResult {
  /** `data:image/png;base64,…` when ready, otherwise null. */
  dataUrl: string | null;
  loading: boolean;
  error: Error | null;
}

const DEFAULTS: Required<Omit<UseQrOptions, "errorCorrectionLevel">> & {
  errorCorrectionLevel: NonNullable<UseQrOptions["errorCorrectionLevel"]>;
} = {
  width: 512,
  margin: 2,
  errorCorrectionLevel: "M",
  dark: "#111827",
  light: "#ffffff",
};

/**
 * Renders a QR PNG for `value`. Returns `null` while pending or when
 * `value` is empty. Regenerates when any option changes.
 */
export function useQr(value: string, opts: UseQrOptions = {}): UseQrResult {
  const width = opts.width ?? DEFAULTS.width;
  const margin = opts.margin ?? DEFAULTS.margin;
  const errorCorrectionLevel = opts.errorCorrectionLevel ?? DEFAULTS.errorCorrectionLevel;
  const dark = opts.dark ?? DEFAULTS.dark;
  const light = opts.light ?? DEFAULTS.light;

  const [dataUrl, setDataUrl] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (!value) {
      setDataUrl(null);
      setLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    QRCode.toDataURL(value, {
      width,
      margin,
      errorCorrectionLevel,
      color: { dark, light },
    })
      .then((url) => {
        if (!cancelled) {
          setDataUrl(url);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setDataUrl(null);
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [value, width, margin, errorCorrectionLevel, dark, light]);

  return { dataUrl, loading, error };
}

/**
 * Pure helper: builds the customer ordering URL for a store slug.
 * Handles trailing slashes and empty origin (SSR safety).
 */
export function buildOrderUrl(origin: string, slug: string): string {
  if (!origin || !slug) return "";
  const cleanOrigin = origin.replace(/\/+$/, "");
  return `${cleanOrigin}/order/${slug}`;
}
