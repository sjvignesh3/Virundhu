/**
 * Auth surface — the SPA calls these; nothing else touches supabase.auth.*.
 *
 *   signup()   → invokes `auth-signup` Edge Function, then signs the user in
 *   login()    → password grant against Supabase Auth
 *   logout()   → clears session (local + broadcast to other tabs)
 *   requestPasswordReset()
 *   updatePassword()
 */
import type { Session } from "@supabase/supabase-js";
import { type SignupInput, type LoginInput } from "@virundhu/shared";
export interface SignupResult {
    user: {
        id: string;
        email: string;
        name?: string;
    };
    store: {
        id: string;
        slug: string;
        name: string;
    };
    session: Session | null;
}
export declare function signup(input: SignupInput): Promise<SignupResult>;
export declare function login(input: LoginInput): Promise<Session>;
export declare function logout(): Promise<void>;
export declare function requestPasswordReset(email: string): Promise<void>;
export declare function updatePassword(newPassword: string): Promise<void>;
/**
 * Returns the primary store id from the current JWT `app_metadata.store_ids`.
 * Called by TanStack Router `beforeLoad` guards; throws when unauthenticated
 * so the route framework can redirect.
 */
export declare function requireStoreId(session: Session | null): string;
