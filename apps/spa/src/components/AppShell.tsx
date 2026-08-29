import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
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
} from "@/components/icons";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: IconGrid },
  { to: "/orders/live", label: "Live Orders", icon: IconReceipt },
  { to: "/products", label: "Products", icon: IconUtensils },
  { to: "/categories", label: "Categories", icon: IconTags },
  { to: "/orders/history", label: "History", icon: IconClock },
  { to: "/reports", label: "Reports", icon: IconChart },
  { to: "/qr", label: "QR Codes", icon: IconQr },
  { to: "/printers", label: "Printers", icon: IconPrinter },
  { to: "/settings", label: "Settings", icon: IconGear },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const storeId = useActiveStoreId();
  const path = useRouterState({ select: (s) => s.location.pathname });

  const store = useQuery({
    queryKey: storeKeys.detail(storeId ?? "none"),
    queryFn: () => storesRepo.get(storeId as string),
    enabled: Boolean(storeId),
    staleTime: 60_000,
  });

  const cartOpen =
    store.data?.status === "OPEN" && store.data?.accept_orders === true;
  const pageTitle =
    NAV.find((n) => path.startsWith(n.to))?.label ?? "Dashboard";

  async function handleLogout() {
    try {
      await logout();
      toast.success("Signed out");
      await navigate({ to: "/login" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Logout failed");
    }
  }

  return (
    <div className="min-h-full flex flex-col md:flex-row">
      <aside className="md:w-60 md:shrink-0 md:h-screen md:sticky md:top-0 flex flex-col border-b md:border-b-0 md:border-r border-neutral-200 bg-white">
        <div className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand grid place-items-center text-white font-bold text-lg shadow-glow">
            வி
          </div>
          <div className="min-w-0">
            <div className="font-bold leading-tight">Virundhu</div>
            <div className="text-xs text-neutral-500 truncate">Owner Console</div>
          </div>
        </div>
        <nav className="px-2 pb-2 flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
          {NAV.map((item) => {
            const active = path.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn("nav-item", active && "nav-item-active")}
              >
                <Icon />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden md:block mt-auto p-4 border-t border-neutral-200 text-xs text-neutral-500">
          <span
            className={cn(
              "inline-block w-2 h-2 rounded-full mr-2",
              cartOpen ? "bg-emerald-600" : "bg-neutral-400",
            )}
          />
          {store.isLoading ? "Checking cart…" : cartOpen ? "Cart is open" : "Cart is closed"}
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 shrink-0 border-b border-neutral-200 bg-white flex items-center justify-between px-4 md:px-6">
          <div className="font-semibold">{pageTitle}</div>
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
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
