"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { chosenBackend } from "@/lib/repositories";
import { apiCurrentSession } from "@/lib/api/auth-api";

/**
 * Client-side gate for the (owner) route group.
 *
 * In `api` mode: redirects to /login when no session exists.
 * In `local` mode: no-op (Phase-1 offline demo needs no auth).
 *
 * Renders `null` until the check completes so we never flash owner UI to
 * an unauthenticated visitor.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    if (chosenBackend() !== "api") {
      setReady(true);
      return;
    }
    if (!apiCurrentSession()) {
      router.replace("/login");
    } else {
      setReady(true);
    }
  }, [router]);

  if (!ready) return null;
  return <>{children}</>;
}
