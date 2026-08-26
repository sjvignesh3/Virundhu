// =============================================================================
// scripts/loadtest/menu.k6.js
// Stage 6 §6.3 · Baseline load test for the public menu edge route.
//
// Simulates 100 concurrent shoppers hitting /api/menu/[slug] for 2 minutes,
// then ramping to 500 for 1 minute. Success criteria (from Plan.md §6.3):
//   • p95 TTFB          < 250ms  (edge-cached)
//   • p95 total latency < 600ms
//   • error rate        < 0.5%
//
// Usage:
//   TARGET_URL=https://app.virundhu.com/api/menu/anna-street-food \
//     k6 run scripts/loadtest/menu.k6.js
//
// Results are written to `Docs/perf/baseline-<date>.md` by the CI job that
// wraps this script.
// =============================================================================

import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate } from "k6/metrics";

const TARGET = __ENV.TARGET_URL ?? "http://localhost:4173/api/menu/anna-street-food";

// Custom metrics so the CI report can post a per-route breakdown.
const menuLatency = new Trend("menu_latency_ms", true);
const menuErrors  = new Rate("menu_errors");

export const options = {
  scenarios: {
    steady: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 100 },  // warm up
        { duration: "2m",  target: 100 },  // steady baseline
        { duration: "30s", target: 500 },  // spike
        { duration: "1m",  target: 500 },  // hold spike
        { duration: "30s", target: 0   },  // drain
      ],
      gracefulRampDown: "10s",
    },
  },
  thresholds: {
    // These are hard gates — CI fails the perf job if any is breached.
    http_req_failed:    ["rate<0.005"],
    http_req_duration:  ["p(95)<600", "p(99)<1200"],
    menu_latency_ms:    ["p(95)<600"],
    menu_errors:        ["rate<0.005"],
  },
};

export default function () {
  const res = http.get(TARGET, {
    headers: { Accept: "application/json" },
    tags:    { route: "menu" },
  });

  menuLatency.add(res.timings.duration);
  const ok = check(res, {
    "status is 200":            (r) => r.status === 200,
    "body has store payload":   (r) => {
      try { return typeof JSON.parse(r.body).store === "object"; }
      catch { return false; }
    },
    // Vercel edge cache should serve the majority of requests. A p95 miss
    // rate above 20% means we're paying origin cost on every request.
    "served from edge cache":   (r) =>
      (r.headers["X-Vercel-Cache"] ?? r.headers["x-vercel-cache"] ?? "")
        .toUpperCase()
        .includes("HIT"),
  });
  menuErrors.add(!ok);

  sleep(1);
}
