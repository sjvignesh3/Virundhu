import { createFileRoute, redirect } from "@tanstack/react-router";
import { useSession } from "@virundhu/client";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    const { status, session } = useSession.getState();
    if (status === "authenticated" && session) {
      throw redirect({ to: "/dashboard" });
    }
    throw redirect({ to: "/login" });
  },
});
