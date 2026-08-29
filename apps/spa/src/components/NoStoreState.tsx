import { useSessionSelector } from "@/lib/useSessionSelector";

/**
 * Rendered when the session resolves but carries no `store_ids` claim —
 * previously an infinite "Loading store…" (audit UX gap). Distinguishes
 * "still resolving" from "this account has no store".
 */
export function NoStoreState() {
  const status = useSessionSelector((s) => s.status);

  if (status === "loading" || status === "idle") {
    return <div className="p-6 text-sm text-neutral-500">Loading store…</div>;
  }
  return (
    <div className="p-6 max-w-md">
      <div className="card p-6">
        <h2 className="font-bold text-lg">No store on this account</h2>
        <p className="text-sm text-neutral-500 mt-2">
          Your sign-in works, but no store is linked to it. If you just signed
          up, try signing out and back in. Otherwise contact support to get
          your store linked.
        </p>
      </div>
    </div>
  );
}
