"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

type NavLinkProps = {
  href: string;
  label: string;
  icon: LucideIcon;
  isActive: boolean;
  variant?: "sidebar" | "tab";
};

/**
 * Client nav link that:
 *   - Aggressively prefetches on hover / focus / touchstart (before the tap fires).
 *   - Uses router.prefetch() so the RSC payload is warm before navigation.
 * This shaves ~100-300ms off route transitions on both desktop and mobile.
 */
export function NavLink({ href, label, icon: Icon, isActive, variant = "sidebar" }: NavLinkProps) {
  const router = useRouter();

  const warm = useCallback(() => {
    router.prefetch(href);
  }, [router, href]);

  if (variant === "tab") {
    return (
      <Link
        href={href}
        prefetch
        onMouseEnter={warm}
        onFocus={warm}
        onTouchStart={warm}
        className={cn(
          "relative flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
          isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
        )}
      >
        {isActive && (
          <span className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-primary" />
        )}
        <Icon className={cn("h-5 w-5 transition-transform", isActive && "scale-110")} />
        <span className="leading-none">{label}</span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      prefetch
      onMouseEnter={warm}
      onFocus={warm}
      onTouchStart={warm}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0 transition-colors",
          isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
        )}
      />
      <span>{label}</span>
    </Link>
  );
}
