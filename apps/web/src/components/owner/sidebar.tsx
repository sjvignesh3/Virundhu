"use client";

import { usePathname } from "next/navigation";
import { ChefHat } from "lucide-react";
import { ownerNav } from "@/lib/owner-nav";
import { NavLink } from "./nav-link";

function isRouteActive(pathname: string, href: string) {
  if (pathname === href) return true;
  // Guard against `/orders` matching `/orders/history` when hovering `/orders/live`.
  return pathname.startsWith(href + "/");
}

export function OwnerSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 md:z-30 border-r bg-card">
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <ChefHat className="h-5 w-5" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold leading-none">Virundhu</span>
          <span className="text-xs text-muted-foreground">Owner Console</span>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {ownerNav.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            isActive={isRouteActive(pathname, item.href)}
          />
        ))}
      </nav>
      <div className="border-t p-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
          <span>Cart is open</span>
        </div>
      </div>
    </aside>
  );
}
