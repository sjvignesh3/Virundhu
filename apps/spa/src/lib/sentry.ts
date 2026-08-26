import * as Sentry from "@sentry/react";

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_APP_ENV ?? "development",
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0.1,
  });
}

export function captureError(error: unknown, tags?: Record<string, string>) {
  if (!import.meta.env.VITE_SENTRY_DSN) {
    // Local/dev: keep console visibility.
    // eslint-disable-next-line no-console
    console.error(error, tags);
    return;
  }
  Sentry.captureException(error, { tags });
}
