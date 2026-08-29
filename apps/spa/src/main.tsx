import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { configureSupabaseEnv, initSessionStore } from "@virundhu/client";
import { initSentry } from "./lib/sentry";
import { queryClient } from "./lib/queryClient";
import { router } from "./router";
import "./styles.css";

// Feed Vite env into the shared @virundhu/client package before anything
// else runs. Must be the very first call so getSupabase() never throws.
configureSupabaseEnv({
  url: import.meta.env.VITE_SUPABASE_URL as string,
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
  publicMenuBaseUrl: (import.meta.env.VITE_PUBLIC_MENU_BASE_URL as string) ?? "",
});

initSentry();

// Bootstrap session before rendering so guards see a resolved state.
void initSessionStore();

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element not found");

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster position="top-right" richColors closeButton />
    </QueryClientProvider>
  </React.StrictMode>,
);
