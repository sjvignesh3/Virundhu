import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useSession } from "@virundhu/client";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_auth")({
  beforeLoad: async () => {
    // Wait a tick for session-store bootstrap if still loading.
    const state = useSession.getState();
    if (state.status === "loading") {
      await new Promise<void>((resolve) => {
        const unsub = useSession.subscribe((s) => {
          if (s.status !== "loading") {
            unsub();
            resolve();
          }
        });
      });
    }
    const { status, session } = useSession.getState();
    if (status !== "authenticated" || !session) {
      throw redirect({ to: "/login" });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
