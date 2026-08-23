"use client";

/**
 * Client-side provider that wires the active repo bundle into React.
 *
 * Backend selection (api vs local) happens at build time via
 * NEXT_PUBLIC_REPO_BACKEND. In "local" mode we seed once and subscribe to
 * localStorage-driven event-bus updates. In "api" mode we skip the seed and
 * still expose the same `useCollection` API — but rely on polling / manual
 * refresh (5-second polling on live-board pages) rather than the storage
 * event-bus.
 */

import * as React from "react";
import { chosenBackend, getRepos, resetReposCache, type Repos } from "./factory";
import { seedIfNeeded } from "@/lib/seed/anna-street-food";
import { ensureCrossTabSync, subscribe, type CollectionName } from "@/lib/storage/event-bus";

const RepoContext = React.createContext<Repos | null>(null);

export function RepoProvider({ children }: { children: React.ReactNode }) {
  const [repos, setRepos] = React.useState<Repos | null>(null);

  React.useEffect(() => {
    if (chosenBackend() === "local") {
      seedIfNeeded();
      ensureCrossTabSync();
    }
    setRepos(getRepos());

    const onAuthChange = () => {
      resetReposCache();
      setRepos(getRepos());
    };
    window.addEventListener("cartsas:auth", onAuthChange);
    window.addEventListener("storage", (e) => {
      if (e.key === "cartsas:v2:auth") onAuthChange();
    });
    return () => {
      window.removeEventListener("cartsas:auth", onAuthChange);
    };
  }, []);

  return <RepoContext.Provider value={repos}>{children}</RepoContext.Provider>;
}

export function useRepos(): Repos | null {
  return React.useContext(RepoContext);
}

/**
 * Runs `loader(repos)` and re-runs whenever the named collection changes.
 *
 * Change detection:
 *   - `local` backend  → subscribes to the event-bus for same-tab writes and
 *     the `storage` event for cross-tab writes.
 *   - `api` backend    → also subscribes to the event-bus so same-tab
 *     mutations (e.g. creating a category) immediately trigger a re-fetch.
 *     Additionally polls every 5 seconds when `poll: true` is passed
 *     (used by the live-board) to pick up other-user writes.
 */
export function useCollection<T>(
  collection: CollectionName,
  loader: (repos: Repos) => Promise<T>,
  options: { poll?: boolean; pollMs?: number } = {},
): { data: T | null; loading: boolean; error: Error | null; refresh: () => void } {
  const repos = useRepos();
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);
  const [tick, setTick] = React.useState(0);

  // We depend on `loader` identity so the fetch re-runs whenever the caller's
  // captured deps (e.g. the current store) change. Callers MUST memoize their
  // loader with `useCallback` — otherwise every parent render will re-fetch.
  React.useEffect(() => {
    if (!repos) return;
    let cancelled = false;
    setLoading(true);
    loader(repos)
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
  }, [repos, collection, tick, loader]);

  // Subscribe to the in-memory event-bus for both backends. In local mode
  // this catches same-tab localStorage writes; in api mode it catches the
  // emit() calls the API repos fire after successful mutations so newly
  // created rows appear without a manual reload.
  React.useEffect(() => {
    if (!repos) return;
    return subscribe(collection, () => setTick((t) => t + 1));
  }, [repos, collection]);

  // API backend: opt-in polling.
  React.useEffect(() => {
    if (!repos || chosenBackend() !== "api" || !options.poll) return;
    const id = window.setInterval(() => setTick((t) => t + 1), options.pollMs ?? 5000);
    return () => window.clearInterval(id);
  }, [repos, options.poll, options.pollMs]);

  const refresh = React.useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, error, refresh };
}
