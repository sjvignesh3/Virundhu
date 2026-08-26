import { useSyncExternalStore } from "react";
import { useSession } from "@virundhu/client";
import type { StoreApi } from "zustand/vanilla";

type State = ReturnType<typeof useSession.getState>;

/**
 * React binding for the vanilla `@virundhu/client` session store.
 * Uses useSyncExternalStore for concurrent-safe subscription.
 */
export function useSessionSelector<T>(selector: (s: State) => T): T {
  const store = useSession as StoreApi<State>;
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getState()),
  );
}
