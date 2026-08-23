"use client";

/**
 * Segment error boundary for owner routes. Next.js App Router mounts this
 * whenever a child component throws during render or a client-side effect.
 * Keeps the sidebar/topbar chrome visible (rendered by the parent layout)
 * and offers a reset button that re-invokes the segment.
 */

import * as React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function OwnerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // Surface unexpected errors in the console so devs / users can share them.
    // eslint-disable-next-line no-console
    console.error("Owner segment error:", error);
  }, [error]);

  return (
    <div className="space-y-6">
      <Card className="border-destructive/40">
        <CardHeader className="flex flex-row items-start gap-3 space-y-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <CardTitle>Something went wrong</CardTitle>
            <CardDescription>
              The screen ran into an error while rendering. Your data is safe —
              try again or head back to the dashboard.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <pre className="max-h-40 overflow-auto rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
            {error.message}
            {error.digest ? `\n\nDigest: ${error.digest}` : ""}
          </pre>
          <div className="flex flex-wrap gap-2">
            <Button onClick={reset}>
              <RotateCcw className="mr-2 h-4 w-4" /> Try again
            </Button>
            <Button asChild variant="outline">
              <a href="/dashboard">Back to dashboard</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
