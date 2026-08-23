"use client";

import { AUTH_STORAGE_KEY, type AuthSession } from "./env";

/**
 * Session storage lives in localStorage under a versioned key. On SSR / first
 * render we return null; all callers must render a skeleton until this hook
 * flips to the resolved session.
 */
export function readSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export function writeSession(session: AuthSession | null): void {
  if (typeof window === "undefined") return;
  if (session) {
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  } else {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  }
  // Notify listeners in the same tab (localStorage events only fire cross-tab).
  window.dispatchEvent(new Event("cartsas:auth"));
}
