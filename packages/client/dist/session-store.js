import { createStore } from "zustand/vanilla";
import { getSupabase } from "./supabase";
const emptyClaim = { storeIds: [], role: null };
function extractClaim(session) {
    if (!session?.user?.app_metadata)
        return emptyClaim;
    const meta = session.user.app_metadata;
    const storeIds = Array.isArray(meta.store_ids)
        ? meta.store_ids.filter((v) => typeof v === "string")
        : [];
    const role = typeof meta.role === "string" &&
        (meta.role === "OWNER" || meta.role === "MANAGER" || meta.role === "STAFF")
        ? meta.role
        : null;
    return { storeIds, role };
}
export const sessionStore = createStore((set) => ({
    session: null,
    user: null,
    claim: emptyClaim,
    status: "idle",
    setSession: (session) => set({
        session,
        user: session?.user ?? null,
        claim: extractClaim(session),
        status: session ? "authenticated" : "anonymous",
    }),
}));
/**
 * Convenience alias so the eventual React SPA can `import { useSession }`
 * and pair it with `useSyncExternalStore` (or `zustand/react`'s `useStore`).
 * Kept as a plain reference to the vanilla store — the React binding lives
 * in the SPA layer so `@virundhu/client` stays framework-free.
 */
export const useSession = sessionStore;
let unsubscribe = null;
/**
 * Idempotent. Safe to call once at app start.
 */
export async function initSessionStore() {
    if (unsubscribe)
        return;
    const supabase = getSupabase();
    useSession.setState({ status: "loading" });
    // Snapshot current session
    const { data } = await supabase.auth.getSession();
    useSession.getState().setSession(data.session);
    // Subscribe to changes
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        useSession.getState().setSession(session);
    });
    unsubscribe = () => sub.subscription.unsubscribe();
}
export function disposeSessionStore() {
    if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
    }
    useSession.setState({
        session: null,
        user: null,
        claim: emptyClaim,
        status: "idle",
    });
}
// -- Selectors ----------------------------------------------------------------
export const selectSession = (s) => s.session;
export const selectUser = (s) => s.user;
export const selectClaim = (s) => s.claim;
export const selectIsAuthed = (s) => s.status === "authenticated";
export const selectPrimaryStoreId = (s) => s.claim.storeIds[0] ?? null;
