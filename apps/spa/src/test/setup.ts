import "@testing-library/jest-dom/vitest";

// Provide minimal Supabase env so the client package can be imported in unit
// tests without triggering its env guard. `import.meta.env` from Vite is a
// Proxy that permits direct assignment even though it isn't a plain object.
if (!import.meta.env.VITE_SUPABASE_URL) {
  (import.meta.env as Record<string, string>).VITE_SUPABASE_URL =
    "http://localhost:54321";
}
if (!import.meta.env.VITE_SUPABASE_ANON_KEY) {
  (import.meta.env as Record<string, string>).VITE_SUPABASE_ANON_KEY =
    "test-anon";
}
