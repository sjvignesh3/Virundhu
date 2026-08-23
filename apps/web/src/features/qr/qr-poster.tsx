"use client";

/**
 * Print-friendly QR poster.
 *
 * A5 layout: giant cart name, "Scan to Order", QR, ordering URL, footer.
 * Global print CSS in `/qr/poster/page.tsx` hides everything else and
 * lays this out edge-to-edge for the browser's Print dialog.
 */

import { useQr } from "./use-qr";
import type { Store } from "@/lib/domain/types";
import { Loader2 } from "lucide-react";

interface QrPosterProps {
  store: Store;
  menuUrl: string;
}

export function QrPoster({ store, menuUrl }: QrPosterProps) {
  const { dataUrl, loading, error } = useQr(menuUrl, {
    width: 1024,
    errorCorrectionLevel: "H",
    margin: 2,
  });

  return (
    <div className="qr-poster mx-auto flex w-full max-w-[520px] flex-col items-center gap-6 rounded-2xl border-2 border-dashed border-slate-300 bg-white p-8 text-center text-slate-900 shadow-sm">
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-widest text-slate-500">
          {store.status === "OPEN" ? "Open · Order now" : "Menu"}
        </p>
        <h1 className="text-4xl font-black leading-tight tracking-tight">
          {store.name}
        </h1>
        {store.tamilName && (
          <p className="text-xl font-medium text-slate-700 font-tamil">
            {store.tamilName}
          </p>
        )}
      </div>

      <div className="text-2xl font-bold uppercase tracking-wide text-primary">
        Scan to Order
      </div>

      <div className="flex aspect-square w-full max-w-[380px] items-center justify-center rounded-lg border border-slate-200 bg-white p-4">
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={dataUrl}
            alt={`Scan to order from ${store.name}`}
            className="h-full w-full object-contain"
          />
        ) : error ? (
          <p className="text-sm text-red-600">Could not generate QR.</p>
        ) : loading ? (
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        ) : null}
      </div>

      <div className="space-y-1">
        <p className="text-sm text-slate-500">or visit</p>
        <p className="break-all text-sm font-semibold text-slate-800">
          {menuUrl.replace(/^https?:\/\//, "")}
        </p>
      </div>

      {store.phone && (
        <p className="text-xs text-slate-500">Call us: {store.phone}</p>
      )}
    </div>
  );
}
