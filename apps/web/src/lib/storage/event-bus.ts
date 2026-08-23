/**
 * Ultra-light pub/sub used to make repository writes reactive in React.
 *
 * Instead of pulling in Zustand or a full query cache, we let repos emit a
 * per-collection "changed" event on every write. `useCollection` subscribes
 * to the collection it reads and re-fetches when notified.
 *
 * Also listens to `storage` events so a write in *another tab* (e.g. customer
 * places an order in a phone tab while the owner watches the live board on a
 * laptop tab) triggers the same re-fetch. This gives us cross-tab sync for
 * free — a Phase 1 acceptance requirement.
 */

export type CollectionName = "stores" | "categories" | "products" | "orders";

type Listener = () => void;

const listeners = new Map<CollectionName, Set<Listener>>();

export function subscribe(collection: CollectionName, fn: Listener): () => void {
  let set = listeners.get(collection);
  if (!set) {
    set = new Set();
    listeners.set(collection, set);
  }
  set.add(fn);
  return () => {
    set!.delete(fn);
  };
}

export function emit(collection: CollectionName): void {
  const set = listeners.get(collection);
  if (!set) return;
  // forEach avoids depending on downlevel Set iteration for older ES targets.
  set.forEach((fn) => fn());
}

/**
 * Wire cross-tab sync. Safe to call multiple times — it guards against
 * double-registration.
 */
let crossTabWired = false;
export function ensureCrossTabSync(): void {
  if (crossTabWired || typeof window === "undefined") return;
  crossTabWired = true;
  window.addEventListener("storage", (e) => {
    if (!e.key) return;
    // Map the storage key back to a collection name.
    if (e.key.endsWith(":stores")) emit("stores");
    else if (e.key.endsWith(":categories")) emit("categories");
    else if (e.key.endsWith(":products")) emit("products");
    else if (e.key.endsWith(":orders")) emit("orders");
  });
}
