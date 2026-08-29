/**
 * Session mirror — the SPA reads `useSession()` anywhere, tabs stay in sync
 * because Supabase JS broadcasts auth events through storage.
 *
 * Boot sequence:
 *   1. SPA calls `initSessionStore()` at the top of main.tsx.
 *   2. We read the persisted session synchronously (best-effort).
 *   3. We subscribe to `onAuthStateChange` — every SIGNED_IN / SIGNED_OUT /
 *      TOKEN_REFRESHED fans out to Zustand.
 *   4. Route guards read `useSession.getState().session` synchronously.
 */
import type { Session, User } from "@supabase/supabase-js";
import { createStore, type StoreApi } from "zustand/vanilla";
import { getSupabase } from "./supabase";

export interface StoreClaim {
  storeIds: string[];
  role: "OWNER" | "MANAGER" | "STAFF" | null;
}

interface SessionState {
  session: Session | null;
  user: User | null;
  claim: StoreClaim;
  status: "idle" | "loading" | "authenticated" | "anonymous";
  setSession: (session: Session | null) => void;
}

const emptyClaim: StoreClaim = { storeIds: [], role: null };

function extractClaim(session: Session | null): StoreClaim {
  if (!session?.user?.app_metadata) return emptyClaim;
  const meta = session.user.app_metadata as Record<string, unknown>;
  const storeIds = Array.isArray(meta.store_ids)
    ? (meta.store_ids as unknown[]).filter(
        (v): v is string => typeof v === "string",
      )
    : [];
  const role =
    typeof meta.role === "string" &&
    (meta.role === "OWNER" || meta.role === "MANAGER" || meta.role === "STAFF")
      ? (meta.role as StoreClaim["role"])
      : null;
  return { storeIds, role };
}

export const sessionStore: StoreApi<SessionState> = createStore<SessionState>(
  (set) => ({
    session: null,
    user: null,
    claim: emptyClaim,
    status: "idle",
    setSession: (session) =>
      set({
        session,
        user: session?.user ?? null,
        claim: extractClaim(session),
        status: session ? "authenticated" : "anonymous",
      }),
  }),
);

/**
 * Convenience alias so the eventual React SPA can `import { useSession }`
 * and pair it with `useSyncExternalStore` (or `zustand/react`'s `useStore`).
 * Kept as a plain reference to the vanilla store — the React binding lives
 * in the SPA layer so `@virundhu/client` stays framework-free.
 */
export const useSession = sessionStore;

let unsubscribe: (() => void) | null = null;

/**
 * Idempotent. Safe to call once at app start.
 */
export async function initSessionStore(): Promise<void> {
  if (unsubscribe) return;
  const supabase = getSupabase();
  useSession.setState({ status: "loading" });

  try {
    // Snapshot current session
    const { data } = await supabase.auth.getSession();
    useSession.getState().setSession(data.session);

    // Subscribe to changes
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      useSession.getState().setSession(session);
    });
    unsubscribe = () => sub.subscription.unsubscribe();
  } catch {
    // Bootstrap failure (bad env, network down) must resolve to a terminal
    // state — a permanent "loading" leaves route guards awaiting forever
    // and the user staring at a blank screen. Anonymous → guards redirect
    // to /login, which surfaces the real error on the next attempt.
    useSession.getState().setSession(null);
  }
}

export function disposeSessionStore(): void {
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

export const selectSession = (s: SessionState) => s.session;
export const selectUser = (s: SessionState) => s.user;
export const selectClaim = (s: SessionState) => s.claim;
export const selectIsAuthed = (s: SessionState) =>
  s.status === "authenticated";
export const selectPrimaryStoreId = (s: SessionState) =>
  s.claim.storeIds[0] ?? null;
