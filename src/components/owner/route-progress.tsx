"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Slim top-of-viewport progress bar that reflects route transitions.
 * We animate it out on every pathname change so users get instant feedback
 * even though Next.js caches most transitions.
 */
export function RouteProgress() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 380);
    return () => clearTimeout(t);
  }, [pathname]);

  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 origin-left bg-primary transition-[transform,opacity] duration-300 ${
        visible ? "scale-x-100 opacity-100" : "scale-x-0 opacity-0"
      }`}
    />
  );
}
