import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { logout, storeKeys, storesRepo } from "@virundhu/client";
import { toast } from "sonner";
import { cn } from "@/lib/cn";
import { useActiveStoreId } from "@/lib/useActiveStoreId";
import {
  IconGrid,
  IconReceipt,
  IconUtensils,
  IconTags,
  IconClock,
  IconChart,
  IconQr,
  IconPrinter,
  IconGear,
  IconLogout,
  IconRupee,
  IconChefHat,
} from "@/components/icons";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: IconGrid },
  { to: "/orders/new", label: "New Order", icon: IconRupee },
  { to: "/orders/live", label: "Live Orders", icon: IconReceipt },
  { to: "/products", label: "Products", icon: IconUtensils },
  { to: "/categories", label: "Categories", icon: IconTags },
  { to: "/orders/history", label: "History", icon: IconClock },
  { to: "/reports", label: "Reports", icon: IconChart },
  { to: "/qr", label: "QR Codes", icon: IconQr },
  { to: "/printers", label: "Printers", icon: IconPrinter },
  { to: "/settings", label: "Settings", icon: IconGear },
] as const;

/** The high-frequency destinations pinned to the mobile bottom tab bar. */
const MOBILE_TABS = [
  { to: "/dashboard", label: "Dashboard", icon: IconGrid },
  { to: "/orders/new", label: "New Order", icon: IconRupee },
  { to: "/orders/live", label: "Live Orders", icon: IconReceipt },
  { to: "/products", label: "Products", icon: IconUtensils },
  { to: "/reports", label: "Reports", icon: IconChart },
] as const;

function isActive(path: string, to: string): boolean {
  // Exact-ish match: /orders/new must not light up /orders/live etc.
  return path === to || path.startsWith(`${to}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const storeId = useActiveStoreId();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Route change closes the drawer (mobile nav tap).
  useEffect(() => {
    setDrawerOpen(false);
  }, [path]);

  const store = useQuery({
    queryKey: storeKeys.detail(storeId ?? "none"),
    queryFn: () => storesRepo.get(storeId as string),
    enabled: Boolean(storeId),
    staleTime: 60_000,
  });

  const cartOpen =
    store.data?.status === "OPEN" && store.data?.accept_orders === true;
  const pageTitle =
    NAV.find((n) => isActive(path, n.to))?.label ?? "Dashboard";

  async function handleLogout() {
    try {
      await logout();
      toast.success("Signed out");
      await navigate({ to: "/login" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Logout failed");
    }
  }

  const cartStatus = (
    <div className="text-xs text-neutral-500">
      <span
        className={cn(
          "inline-block w-2 h-2 rounded-full mr-2",
          cartOpen ? "bg-emerald-600" : "bg-neutral-400",
        )}
      />
      {store.isLoading ? "Checking cart…" : cartOpen ? "Cart is open" : "Cart is closed"}
    </div>
  );

  const brand = (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-brand grid place-items-center text-white shadow-glow">
        <IconChefHat width={22} height={22} />
      </div>
      <div className="min-w-0">
        <div className="font-bold leading-tight">Virundhu</div>
        <div className="text-xs text-neutral-500 truncate">Owner Console</div>
      </div>
    </div>
  );

  return (
    <div className="min-h-full flex">
      {/* ── Desktop sidebar ─────────────────────────────────────────────── */}
      <aside className="hidden md:flex md:w-60 md:shrink-0 md:h-screen md:sticky md:top-0 flex-col border-r border-neutral-200 bg-white">
        <div className="p-4">{brand}</div>
        <nav className="px-2 pb-2 flex flex-col gap-1 overflow-y-auto">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn("nav-item", isActive(path, item.to) && "nav-item-active")}
              >
                <Icon />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto p-4 border-t border-neutral-200">{cartStatus}</div>
      </aside>

      {/* ── Mobile drawer ───────────────────────────────────────────────── */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            aria-label="Close menu"
            className="absolute inset-0 bg-black/60"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white border-r border-neutral-200 flex flex-col">
            <div className="p-4 flex items-center justify-between">
              {brand}
              <button
                aria-label="Close menu"
                className="p-2 text-neutral-400 hover:text-neutral-800"
                onClick={() => setDrawerOpen(false)}
              >
                ✕
              </button>
            </div>
            <nav className="px-2 pb-2 flex flex-col gap-1 overflow-y-auto">
              {NAV.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn("nav-item", isActive(path, item.to) && "nav-item-active")}
                  >
                    <Icon />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="mt-auto p-4 border-t border-neutral-200">{cartStatus}</div>
          </div>
        </div>
      ) : null}

      {/* ── Content column ──────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 shrink-0 sticky top-0 z-30 border-b border-neutral-200 bg-white flex items-center justify-between px-3 md:px-6">
          <div className="flex items-center gap-2">
            <button
              className="md:hidden p-2 -ml-1 text-neutral-600"
              aria-label="Open menu"
              onClick={() => setDrawerOpen(true)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="font-semibold">{pageTitle}</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:block text-xs text-neutral-500 truncate max-w-[180px]">
              {store.data?.name ?? ""}
            </span>
            <button
              onClick={handleLogout}
              className="btn btn-outline !px-2.5 !py-1.5"
              title="Sign out"
              aria-label="Sign out"
            >
              <IconLogout />
            </button>
          </div>
        </header>

        {/* pb-20 on mobile clears the fixed bottom tab bar */}
        <main className="flex-1 min-w-0 pb-24 md:pb-0">{children}</main>
      </div>

      {/* ── Mobile bottom tab bar ───────────────────────────────────────── */}
      <nav
        className="md:hidden fixed inset-x-0 bottom-0 z-40 bg-white border-t border-neutral-200 grid grid-cols-5"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Primary"
      >
        {MOBILE_TABS.map((item) => {
          const active = isActive(path, item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-[10.5px] font-medium border-t-2",
                active
                  ? "text-brand border-brand"
                  : "text-neutral-500 border-transparent",
              )}
            >
              <Icon />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
