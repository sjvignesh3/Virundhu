import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { initSessionStore } from "@virundhu/client";
import { initSentry } from "./lib/sentry";
import { queryClient } from "./lib/queryClient";
import { router } from "./router";
import "./styles.css";

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
