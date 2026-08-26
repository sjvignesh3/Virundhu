import { selectPrimaryStoreId } from "@virundhu/client";
import { useSessionSelector } from "./useSessionSelector";

/** Reactive hook returning the current owner's primary store id, or `null` while unresolved. */
export function useActiveStoreId(): string | null {
  return useSessionSelector(selectPrimaryStoreId);
}
