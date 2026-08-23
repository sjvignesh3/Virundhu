"use client";

import * as React from "react";
import { Menu, Search, Bell, LogOut } from "lucide-react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { MobileDrawer } from "@/components/owner/mobile-drawer";
import { ownerNav } from "@/lib/owner-nav";
import { apiLogout } from "@/lib/api/auth-api";
import { chosenBackend } from "@/lib/repositories";

function useCurrentTitle() {
  const pathname = usePathname();
  const match = ownerNav.find(
    (i) => pathname === i.href || pathname.startsWith(i.href + "/"),
  );
  return match?.label ?? "Virundhu";
}

export function OwnerTopBar() {
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const title = useCurrentTitle();

  function handleLogout() {
    apiLogout();
    // Hard navigation resets in-memory React state (repo caches, useCollection
    // results, session listeners) so the login page renders from a clean slate.
    // `router.replace` alone kept the (owner) layout mounted, causing the
    // "stuck on dashboard with zeroed data" symptom.
    if (typeof window !== "undefined") {
      window.location.assign("/login");
    }
  }

  return (
    <>
      <header
        className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur md:px-6"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <h1 className="text-base font-semibold md:text-lg">{title}</h1>

        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="hidden sm:inline-flex"
            aria-label="Search"
          >
            <Search className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Notifications">
            <Bell className="h-5 w-5" />
          </Button>
          <ThemeToggle />
          {chosenBackend() === "api" && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          )}
        </div>
      </header>

      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
