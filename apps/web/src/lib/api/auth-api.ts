import type { AuthLoginResponse } from "@cartsas/shared";
import { apiFetch } from "./client";
import { writeSession, readSession } from "./session";
import type { AuthSession } from "./env";

export async function apiLogin(email: string, password: string): Promise<AuthSession> {
  const resp = await apiFetch<AuthLoginResponse>("/auth/login", {
    method: "POST",
    body: { email, password },
    anonymous: true,
  });
  if (resp.memberships.length === 0) {
    throw new Error("This user is not linked to any store.");
  }
  const first = resp.memberships[0];
  const session: AuthSession = {
    accessToken: resp.accessToken,
    userId: resp.user.id,
    email: resp.user.email,
    storeId: first.storeId,
    storeSlug: first.store.slug,
  };
  writeSession(session);
  return session;
}

export function apiLogout(): void {
  writeSession(null);
}

export function apiCurrentSession(): AuthSession | null {
  return readSession();
}
