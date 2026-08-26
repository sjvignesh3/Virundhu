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
import { type StoreApi } from "zustand/vanilla";
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
export declare const sessionStore: StoreApi<SessionState>;
/**
 * Convenience alias so the eventual React SPA can `import { useSession }`
 * and pair it with `useSyncExternalStore` (or `zustand/react`'s `useStore`).
 * Kept as a plain reference to the vanilla store — the React binding lives
 * in the SPA layer so `@virundhu/client` stays framework-free.
 */
export declare const useSession: StoreApi<SessionState>;
/**
 * Idempotent. Safe to call once at app start.
 */
export declare function initSessionStore(): Promise<void>;
export declare function disposeSessionStore(): void;
export declare const selectSession: (s: SessionState) => Session | null;
export declare const selectUser: (s: SessionState) => User | null;
export declare const selectClaim: (s: SessionState) => StoreClaim;
export declare const selectIsAuthed: (s: SessionState) => boolean;
export declare const selectPrimaryStoreId: (s: SessionState) => string | null;
export {};
