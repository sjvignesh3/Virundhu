"use client";

/**
 * Client-side provider that:
 *   1. Seeds the demo store once (idempotent).
 *   2. Wires cross-tab sync.
 *   3. Exposes memoized repo instances via context.
 *
 * `useRepos()` returns `null` during SSR and the first render — consumers
 * should render a skeleton in that window. After mount it is stable.
 */

import * as React from "react";
import { getRepos, type Repos } from "./factory";
import { seedIfNeeded } from "@/lib/seed/anna-street-food";
import { ensureCrossTabSync, subscribe, type CollectionName } from "@/lib/storage/event-bus";

const RepoContext = React.createContext<Repos | null>(null);

export function RepoProvider({ children }: { children: React.ReactNode }) {
  const [repos, setRepos] = React.useState<Repos | null>(null);

  React.useEffect(() => {
    seedIfNeeded();
    ensureCrossTabSync();
    setRepos(getRepos());
  }, []);

  return <RepoContext.Provider value={repos}>{children}</RepoContext.Provider>;
}

export function useRepos(): Repos | null {
  return React.useContext(RepoContext);
}

/**
 * Runs `loader(repos)` and re-runs whenever the named collection changes
 * (either via a same-tab write or a cross-tab `storage` event). Returns
 * `{ data, loading, error, refresh }`.
 */
export function useCollection<T>(
  collection: CollectionName,
  loader: (repos: Repos) => Promise<T>,
): { data: T | null; loading: boolean; error: Error | null; refresh: () => void } {
  const repos = useRepos();
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);
  const [tick, setTick] = React.useState(0);

  // Keep loader in a ref so identity changes don't retrigger the effect;
  // we only re-run when `repos`, `collection`, or `tick` change.
  const loaderRef = React.useRef(loader);
  React.useEffect(() => {
    loaderRef.current = loader;
  }, [loader]);

  React.useEffect(() => {
    if (!repos) return;
    let cancelled = false;
    setLoading(true);
    loaderRef
      .current(repos)
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [repos, collection, tick]);

  React.useEffect(() => {
    if (!repos) return;
    return subscribe(collection, () => setTick((t) => t + 1));
  }, [repos, collection]);

  const refresh = React.useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, error, refresh };
}
