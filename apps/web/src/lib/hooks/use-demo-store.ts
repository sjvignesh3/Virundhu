"use client";

import * as React from "react";
import { useCollection } from "@/lib/repositories/repo-provider";
import { DEMO_STORE_SLUG } from "@/lib/seed/anna-street-food";
import { chosenBackend } from "@/lib/repositories";
import { apiCurrentSession } from "@/lib/api/auth-api";
import type { Store } from "@/lib/domain/types";

/**
 * Every owner screen resolves the current store via this hook so future
 * multi-store support is a one-line change (pass the slug from layout
 * params instead of the constant). In API mode the slug comes from the
 * authenticated session's membership; in local mode it's the seeded demo.
 */
export function useDemoStore(): {
  store: Store | null;
  loading: boolean;
  error: Error | null;
} {
  const loader = React.useCallback(
    (repos: import("@/lib/repositories").Repos) => {
      if (chosenBackend() === "api") {
        const s = apiCurrentSession();
        if (!s) return Promise.resolve(null);
        return repos.stores.get(s.storeId);
      }
      return repos.stores.getBySlug(DEMO_STORE_SLUG);
    },
    [],
  );
  const { data, loading, error } = useCollection("stores", loader);
  return { store: data, loading, error };
}
