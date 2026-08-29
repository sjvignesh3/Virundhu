/**
 * QR Codes — Plan §3.3 line 8 (was missing entirely; audit gap). Client-only:
 * generates the poster QR for /order/:slug with the `qrcode` lib, no backend
 * call.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import QRCode from "qrcode";
import { storeKeys, storesRepo } from "@virundhu/client";
import { useActiveStoreId } from "@/lib/useActiveStoreId";
import { PageHeader } from "@/components/PageHeader";
import { NoStoreState } from "@/components/NoStoreState";
import { IconQr } from "@/components/icons";

export const Route = createFileRoute("/_auth/qr")({
  component: QrPage,
});

function QrPage() {
  const storeId = useActiveStoreId();
  if (!storeId) return <NoStoreState />;
  return <QrInner storeId={storeId} />;
}

function QrInner({ storeId }: { storeId: string }) {
  const store = useQuery({
    queryKey: storeKeys.detail(storeId),
    queryFn: () => storesRepo.get(storeId),
    staleTime: 60_000,
  });

  const slug = store.data?.slug;
  const menuUrl = slug ? `${window.location.origin}/order/${slug}` : null;
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!menuUrl) return;
    QRCode.toDataURL(menuUrl, {
      width: 640,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#1A1512", light: "#FFFFFF" },
    })
      .then(setDataUrl)
      .catch(() => toast.error("Could not generate the QR code"));
  }, [menuUrl]);

  function downloadPng() {
    if (!dataUrl || !slug) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `virundhu-qr-${slug}.png`;
    a.click();
  }

  function printPoster() {
    if (!dataUrl || !store.data) return;
    const w = window.open("", "_blank", "width=640,height=800");
    if (!w) {
      toast.error("Allow pop-ups to print the poster");
      return;
    }
    w.document.write(`<!doctype html>
<title>Scan to order — ${escapeHtml(store.data.name)}</title>
<body style="font-family:system-ui;text-align:center;padding:40px;color:#111">
  <h1 style="font-size:34px;margin:0 0 4px">${escapeHtml(store.data.name)}</h1>
  <p style="font-size:18px;color:#555;margin:0 0 24px">Scan to see the menu &amp; order</p>
  <img src="${dataUrl}" style="width:420px;max-width:90%" alt="QR code" />
  <p style="font-size:14px;color:#777;margin-top:24px">${escapeHtml(menuUrl ?? "")}</p>
  <script>window.onload = () => setTimeout(() => window.print(), 150);</script>
</body>`);
    w.document.close();
  }

  async function copyLink() {
    if (!menuUrl) return;
    try {
      await navigator.clipboard.writeText(menuUrl);
      toast.success("Link copied");
    } catch {
      toast.error("Copy failed — select the URL and copy manually");
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl">
      <PageHeader
        title="QR Code"
        subtitle="Print this and stick it on your cart — customers scan to open your menu."
      />

      {store.isLoading ? (
        <div className="text-sm text-neutral-500">Loading…</div>
      ) : store.error ? (
        <div className="card p-4 border-red-200 bg-red-50 text-red-700 text-sm">
          {(store.error as Error).message}
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4 items-start">
          {/* Menu QR */}
          <div className="card p-5">
            <h2 className="font-bold">Menu QR</h2>
            <p className="text-sm text-neutral-500 mb-4">
              Points to your public ordering page.
            </p>
            <div className="mx-auto w-64 h-64 rounded-2xl bg-[#FFFFFF] p-3 grid place-items-center">
              {dataUrl ? (
                <img src={dataUrl} alt={`QR code for ${menuUrl}`} className="w-full h-full" />
              ) : (
                <div className="text-sm text-neutral-400">Generating…</div>
              )}
            </div>
            <div className="flex gap-2 mt-5">
              <button className="btn btn-primary flex-1" onClick={downloadPng} disabled={!dataUrl}>
                ⬇ Download PNG
              </button>
              <button className="btn btn-outline flex-1" onClick={printPoster} disabled={!dataUrl}>
                🖨 Print poster
              </button>
            </div>
          </div>

          {/* Menu link */}
          <div className="card p-5">
            <h2 className="font-bold">Menu link</h2>
            <p className="text-sm text-neutral-500 mb-4">
              Share directly with customers on WhatsApp / SMS.
            </p>
            <label htmlFor="qr-url" className="block text-xs font-bold uppercase tracking-wide text-neutral-500 mb-1.5">
              URL
            </label>
            <input id="qr-url" className="input font-mono text-xs" readOnly value={menuUrl ?? ""} />
            <div className="flex gap-2 mt-3">
              <button className="btn btn-outline flex-1" onClick={copyLink}>
                ⧉ Copy link
              </button>
              <a
                className="btn btn-outline flex-1"
                href={menuUrl ?? "#"}
                target="_blank"
                rel="noreferrer"
              >
                ↗ Open
              </a>
            </div>
            <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-100 p-4 flex gap-3 text-sm">
              <span className="text-brand mt-0.5">
                <IconQr />
              </span>
              <div>
                <div className="font-semibold">Print tip</div>
                <div className="text-neutral-500 mt-0.5">
                  Print at least 5×5 cm on matte paper. Laminate for outdoor stalls.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
