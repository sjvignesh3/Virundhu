import { Link } from "@tanstack/react-router";
import { captureError } from "@/lib/sentry";
import { useEffect } from "react";

export function AppErrorBoundary({ error }: { error: unknown }) {
  useEffect(() => {
    captureError(error, { boundary: "root" });
  }, [error]);

  const message = error instanceof Error ? error.message : "Something went wrong";
  return (
    <div className="min-h-full grid place-items-center p-6">
      <div className="card max-w-md p-6 text-center">
        <h1 className="text-lg font-semibold mb-2">Something went wrong</h1>
        <p className="text-sm text-neutral-600 mb-4">{message}</p>
        <Link to="/" className="btn btn-primary">
          Go home
        </Link>
      </div>
    </div>
  );
}
