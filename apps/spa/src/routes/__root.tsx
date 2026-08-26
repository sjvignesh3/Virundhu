import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
  errorComponent: ({ error }) => <AppErrorBoundary error={error} />,
});

function RootComponent() {
  return <Outlet />;
}
