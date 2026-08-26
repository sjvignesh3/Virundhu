/**
 * Dashboard & Reports API calls.
 *
 * These hit the backend aggregation endpoints so metrics are always
 * computed from real database data — no client-side recalculation needed.
 *
 * Both hooks are thin wrappers over `useCollection` so they get the same
 * loading / error / refresh pattern used everywhere else in the app.
 */

import type { DashboardMetricsDTO, ReportsSummaryDTO } from "@virundhu/shared";
import { apiFetch } from "./client";

export async function fetchDashboardMetrics(storeId: string): Promise<DashboardMetricsDTO> {
  return apiFetch<DashboardMetricsDTO>(`/stores/${storeId}/dashboard`);
}

export async function fetchReportsSummary(
  storeId: string,
  opts: { from?: string; to?: string } = {},
): Promise<ReportsSummaryDTO> {
  return apiFetch<ReportsSummaryDTO>(`/stores/${storeId}/reports`, {
    query: { from: opts.from, to: opts.to },
  });
}
