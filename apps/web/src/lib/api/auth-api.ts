import type { AuthLoginResponse, SignupInput } from "@virundhu/shared";
import { apiFetch } from "./client";
import { writeSession, readSession } from "./session";
import type { AuthSession } from "./env";

function sessionFromLoginResponse(resp: AuthLoginResponse): AuthSession {
  if (resp.memberships.length === 0) {
    throw new Error("This user is not linked to any store.");
  }
  const first = resp.memberships[0];
  return {
    accessToken: resp.accessToken,
    userId: resp.user.id,
    email: resp.user.email,
    storeId: first.storeId,
    storeSlug: first.store.slug,
  };
}

export async function apiLogin(email: string, password: string): Promise<AuthSession> {
  const resp = await apiFetch<AuthLoginResponse>("/auth/login", {
    method: "POST",
    body: { email, password },
    anonymous: true,
  });
  const session = sessionFromLoginResponse(resp);
  writeSession(session);
  return session;
}

export async function apiSignup(input: SignupInput): Promise<AuthSession> {
  const resp = await apiFetch<AuthLoginResponse, SignupInput>("/auth/signup", {
    method: "POST",
    body: input,
    anonymous: true,
  });
  const session = sessionFromLoginResponse(resp);
  writeSession(session);
  return session;
}

export function apiLogout(): void {
  writeSession(null);
}

export function apiCurrentSession(): AuthSession | null {
  return readSession();
}
