/**
 * Back-compat redirect — earlier builds minted /menu/:slug links; the
 * canonical customer URL is /order/:slug (matches legacy printed QRs).
 */
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/menu/$slug")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/order/$slug", params: { slug: params.slug }, replace: true });
  },
});
