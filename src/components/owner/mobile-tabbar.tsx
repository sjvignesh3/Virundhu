"use client";

import { usePathname } from "next/navigation";
import { ownerNav } from "@/lib/owner-nav";
import { NavLink } from "./nav-link";

export function MobileTabBar() {
  const pathname = usePathname();
  const items = ownerNav.filter((i) => i.primary);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid h-16 grid-cols-4">
        {items.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <li key={item.href} className="flex">
              <NavLink
                href={item.href}
                label={item.label}
                icon={item.icon}
                isActive={isActive}
                variant="tab"
              />
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
