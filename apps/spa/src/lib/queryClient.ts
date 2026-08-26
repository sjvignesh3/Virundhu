import { QueryClient } from "@tanstack/react-query";
import { ClientApiError } from "@virundhu/client";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Don't retry auth or validation errors — they will not self-heal.
        if (error instanceof ClientApiError) {
          if (["UNAUTHORIZED", "FORBIDDEN", "VALIDATION_ERROR", "NOT_FOUND"].includes(error.code)) {
            return false;
          }
        }
        return failureCount < 1;
      },
    },
    mutations: {
      retry: 0,
    },
  },
});
