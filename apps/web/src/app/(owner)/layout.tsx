import { Toaster } from "sonner";
import { OwnerSidebar } from "@/components/owner/sidebar";
import { OwnerTopBar } from "@/components/owner/topbar";
import { MobileTabBar } from "@/components/owner/mobile-tabbar";
import { RouteProgress } from "@/components/owner/route-progress";
import { PrefetchPrimary } from "@/components/owner/prefetch-primary";
import { RepoProvider } from "@/lib/repositories/repo-provider";
import { AuthGuard } from "@/components/auth/auth-guard";

export default function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RepoProvider>
      <AuthGuard>
        <div className="min-h-screen bg-background">
          <RouteProgress />
          <PrefetchPrimary />
          <OwnerSidebar />
          <div className="md:pl-64">
            <OwnerTopBar />
            <main className="mx-auto w-full max-w-7xl px-4 pb-24 pt-6 md:px-6 md:pb-10">
              {children}
            </main>
          </div>
          <MobileTabBar />
          <Toaster position="top-right" richColors closeButton />
        </div>
      </AuthGuard>
    </RepoProvider>
  );
}
