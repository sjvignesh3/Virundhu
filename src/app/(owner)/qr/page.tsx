"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Copy, Download, ExternalLink, Loader2, Printer, QrCode } from "lucide-react";
import { PageHeader } from "@/components/owner/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDemoStore } from "@/lib/hooks/use-demo-store";
import { buildOrderUrl, useQr } from "@/features/qr/use-qr";

export default function QrPage() {
  const { store, loading } = useDemoStore();
  const [copied, setCopied] = React.useState(false);
  const [origin, setOrigin] = React.useState<string>("");

  React.useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  const menuUrl = store ? buildOrderUrl(origin, store.slug) : "";
  const { dataUrl } = useQr(menuUrl);

  function copyLink() {
    if (!menuUrl) return;
    navigator.clipboard.writeText(menuUrl).then(() => {
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function download() {
    if (!dataUrl || !store) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${store.slug}-menu-qr.png`;
    a.click();
  }

  if (loading || !store) {
    return (
      <div className="space-y-6">
        <PageHeader title="QR Code" description="Loading…" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="QR Code"
        description="Print this and stick it on your cart — customers scan to open your menu."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Menu QR</CardTitle>
            <CardDescription>Points to your public ordering page.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <div className="flex h-64 w-64 items-center justify-center rounded-lg border bg-white p-3">
              {dataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={dataUrl}
                  alt={`QR for ${store.name}`}
                  className="h-full w-full object-contain"
                />
              ) : (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              )}
            </div>
            <div className="flex w-full flex-wrap gap-2">
              <Button className="flex-1" onClick={download} disabled={!dataUrl}>
                <Download className="mr-2 h-4 w-4" /> Download PNG
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <Link href="/qr/poster">
                  <Printer className="mr-2 h-4 w-4" /> Print poster
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Menu link</CardTitle>
            <CardDescription>Share directly with customers on WhatsApp / SMS.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="menu-url">URL</Label>
              <Input id="menu-url" readOnly value={menuUrl} />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={copyLink} className="flex-1">
                <Copy className="mr-2 h-4 w-4" />
                {copied ? "Copied!" : "Copy link"}
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <a href={menuUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" /> Open
                </a>
              </Button>
            </div>
            <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
              <div className="flex items-start gap-2">
                <QrCode className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-medium text-foreground">Print tip</p>
                  <p className="mt-1">
                    Print at least 5×5&nbsp;cm on matte paper. Laminate for outdoor stalls.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
