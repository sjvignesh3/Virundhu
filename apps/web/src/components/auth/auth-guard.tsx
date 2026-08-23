"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { chosenBackend } from "@/lib/repositories";
import { apiCurrentSession } from "@/lib/api/auth-api";

/**
 * Client-side gate for the (owner) route group.
 *
 * In `api` mode: redirects to /login when no session exists, and reactively
 * kicks the user out if the session is cleared while they are inside the
 * owner console (topbar sign-out, 401 auto-logout, other-tab logout).
 *
 * In `local` mode: no-op (Phase-1 offline demo needs no auth).
 *
 * Renders `null` until the initial check completes so we never flash owner UI
 * to an unauthenticated visitor.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    if (chosenBackend() !== "api") {
      setReady(true);
      return;
    }

    // Initial check.
    if (!apiCurrentSession()) {
      router.replace("/login");
      return;
    }
    setReady(true);

    // Reactive check: same-tab custom event + cross-tab storage event.
    const onAuthChange = () => {
      if (!apiCurrentSession()) {
        // Hard nav ensures every mounted client component (topbar, sidebar,
        // useCollection subscribers) tears down cleanly.
        window.location.assign("/login");
      }
    };
    window.addEventListener("cartsas:auth", onAuthChange);
    window.addEventListener("storage", onAuthChange);
    return () => {
      window.removeEventListener("cartsas:auth", onAuthChange);
      window.removeEventListener("storage", onAuthChange);
    };
  }, [router]);

  if (!ready) return null;
  return <>{children}</>;
}
