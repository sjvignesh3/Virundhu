import { RepoProvider } from "@/lib/repositories/repo-provider";

/**
 * Customer-facing route: no owner chrome (no sidebar / topbar / tabbar).
 * We still need `RepoProvider` so the ordering page can read the seeded store.
 */
export default function CustomerOrderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RepoProvider>
      <div className="min-h-screen bg-background">{children}</div>
    </RepoProvider>
  );
}
