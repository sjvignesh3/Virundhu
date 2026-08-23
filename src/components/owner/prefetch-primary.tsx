"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ownerNav } from "@/lib/owner-nav";

/**
 * Warms the router cache for every owner route once the shell mounts.
 * Runs a single microtask on the client — no impact on initial paint.
 */
export function PrefetchPrimary() {
  const router = useRouter();

  useEffect(() => {
    // Kick prefetch after paint so it never competes with critical work.
    const id = window.requestIdleCallback
      ? window.requestIdleCallback(() => {
          ownerNav.forEach((i) => router.prefetch(i.href));
        })
      : window.setTimeout(() => {
          ownerNav.forEach((i) => router.prefetch(i.href));
        }, 200);

    return () => {
      if (typeof id === "number") window.clearTimeout(id);
      else window.cancelIdleCallback?.(id as unknown as number);
    };
  }, [router]);

  return null;
}
