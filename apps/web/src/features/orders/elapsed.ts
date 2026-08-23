import * as React from "react";

/** Human-friendly elapsed string for an ISO timestamp. Updates on `tick` bump. */
export function formatElapsed(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  const diffSec = Math.max(0, Math.floor((now - then) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ${min % 60}m ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

/** Force a re-render every `ms` — used by cards showing live "N minutes ago". */
export function useTicker(ms = 30000): void {
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), ms);
    return () => window.clearInterval(id);
  }, [ms]);
}
