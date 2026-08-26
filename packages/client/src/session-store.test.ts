/**
 * Session store — unit tests for the claim-extraction selectors. No network.
 */
import { describe, expect, it } from "vitest";
import type { Session } from "@supabase/supabase-js";
import {
  useSession,
  selectPrimaryStoreId,
  selectIsAuthed,
  selectClaim,
} from "./session-store";

function makeSession(app_metadata: Record<string, unknown>): Session {
  return {
    access_token: "t",
    refresh_token: "r",
    expires_in: 3600,
    token_type: "bearer",
    user: {
      id: "u-1",
      app_metadata,
      user_metadata: {},
      aud: "authenticated",
      created_at: new Date().toISOString(),
    },
  } as unknown as Session;
}

describe("session-store selectors", () => {
  it("no session → anonymous", () => {
    useSession.getState().setSession(null);
    const s = useSession.getState();
    expect(selectIsAuthed(s)).toBe(false);
    expect(selectPrimaryStoreId(s)).toBeNull();
    expect(selectClaim(s).storeIds).toEqual([]);
  });

  it("extracts storeIds + role from app_metadata", () => {
    const session = makeSession({
      store_ids: ["store-a", "store-b"],
      role: "OWNER",
    });
    useSession.getState().setSession(session);
    const s = useSession.getState();
    expect(selectIsAuthed(s)).toBe(true);
    expect(selectPrimaryStoreId(s)).toBe("store-a");
    expect(selectClaim(s).role).toBe("OWNER");
  });

  it("ignores malformed store_ids gracefully", () => {
    const session = makeSession({
      store_ids: [42, null, "ok"],
      role: "MANAGER",
    });
    useSession.getState().setSession(session);
    expect(selectClaim(useSession.getState()).storeIds).toEqual(["ok"]);
  });

  it("unknown role → null", () => {
    const session = makeSession({ store_ids: ["s"], role: "SUPERUSER" });
    useSession.getState().setSession(session);
    expect(selectClaim(useSession.getState()).role).toBeNull();
  });
});
