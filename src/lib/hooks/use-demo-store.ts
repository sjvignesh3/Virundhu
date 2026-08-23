"use client";

import * as React from "react";
import { useCollection } from "@/lib/repositories/repo-provider";
import { DEMO_STORE_SLUG } from "@/lib/seed/anna-street-food";
import type { Store } from "@/lib/domain/types";

/**
 * Phase 1 has exactly one store. Every owner screen resolves it via this hook
 * so future multi-store support is a one-line change (pass the slug from
 * layout params instead of the constant).
 */
export function useDemoStore(): {
  store: Store | null;
  loading: boolean;
  error: Error | null;
} {
  const loader = React.useCallback(
    (repos: import("@/lib/repositories").Repos) => repos.stores.getBySlug(DEMO_STORE_SLUG),
    [],
  );
  const { data, loading, error } = useCollection("stores", loader);
  return { store: data, loading, error };
}
