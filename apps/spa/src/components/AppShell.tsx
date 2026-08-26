import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { logout } from "@virundhu/client";
import { toast } from "sonner";
import { cn } from "@/lib/cn";
import { useActiveStoreId } from "@/lib/useActiveStoreId";
import { useSessionSelector } from "@/lib/useSessionSelector";

const NAV = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/orders/live", label: "Live orders" },
  { to: "/orders/history", label: "History" },
  { to: "/products", label: "Products" },
  { to: "/categories", label: "Categories" },
  { to: "/printers", label: "Printers" },
  { to: "/reports", label: "Reports" },
  { to: "/settings", label: "Settings" },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const email = useSessionSelector((s) => s.session?.user.email);
  const storeId = useActiveStoreId();
  const path = useRouterState({ select: (s) => s.location.pathname });

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
      <aside className="md:w-56 border-b md:border-b-0 md:border-r border-neutral-200 bg-white">
        <div className="p-4 border-b border-neutral-200">
          <div className="text-lg font-semibold text-brand">Virundhu</div>
          <div className="text-xs text-neutral-500 truncate">{email ?? "—"}</div>
          {storeId ? (
            <div className="text-[10px] text-neutral-400 truncate">Store {storeId.slice(0, 8)}</div>
          ) : null}
        </div>
        <nav className="p-2 flex md:flex-col gap-1 overflow-x-auto">
          {NAV.map((item) => {
            const active = path.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "px-3 py-2 rounded-md text-sm whitespace-nowrap",
                  active ? "bg-brand text-brand-fg" : "hover:bg-neutral-100",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-2 md:mt-auto">
          <button onClick={handleLogout} className="btn btn-outline w-full text-sm">
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
