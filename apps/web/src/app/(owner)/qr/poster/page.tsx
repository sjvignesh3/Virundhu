"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QrPoster } from "@/features/qr/qr-poster";
import { buildOrderUrl } from "@/features/qr/use-qr";
import { useDemoStore } from "@/lib/hooks/use-demo-store";

export default function QrPosterPage() {
  const { store, loading } = useDemoStore();
  const [origin, setOrigin] = React.useState("");

  React.useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  const menuUrl = store ? buildOrderUrl(origin, store.slug) : "";

  if (loading || !store) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading poster…
      </div>
    );
  }

  return (
    <>
      {/* Toolbar hidden when printing. */}
      <div className="poster-toolbar flex items-center justify-between border-b bg-background/60 px-4 py-3 print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link href="/qr">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to QR
          </Link>
        </Button>
        <Button onClick={() => window.print()} disabled={!menuUrl}>
          <Printer className="mr-2 h-4 w-4" />
          Print poster
        </Button>
      </div>

      <div className="poster-viewport flex min-h-[70vh] items-center justify-center bg-muted/30 p-6 print:min-h-0 print:bg-white print:p-0">
        <QrPoster store={store} menuUrl={menuUrl} />
      </div>

      <style jsx global>{`
        @media print {
          /* Neutralise the owner shell chrome while printing. */
          aside,
          header,
          nav,
          .poster-toolbar {
            display: none !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
            max-width: none !important;
          }
          html,
          body {
            background: #fff !important;
          }
          .poster-viewport {
            background: #fff !important;
            min-height: 0 !important;
            padding: 0 !important;
          }
          @page {
            size: A5;
            margin: 8mm;
          }
        }
      `}</style>
    </>
  );
}
