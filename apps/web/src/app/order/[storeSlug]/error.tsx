"use client";

/**
 * Segment error boundary for the customer ordering page. Keeps a friendly
 * message + retry, avoids leaking stack traces to guests.
 */

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OrderError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("Order segment error:", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="h-7 w-7" />
      </div>
      <div className="space-y-1">
        <h1 className="text-xl font-bold">We hit a snag</h1>
        <p className="text-sm text-muted-foreground">
          The menu didn&apos;t load correctly. Please try again — your cart is
          still saved for this session.
        </p>
      </div>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
