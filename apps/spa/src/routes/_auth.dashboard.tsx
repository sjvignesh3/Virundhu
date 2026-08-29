import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  dashboardKeys,
  dashboardRepo,
  orderKeys,
  ordersRepo,
  storeKeys,
  storesRepo,
} from "@virundhu/client";
import { useActiveStoreId } from "@/lib/useActiveStoreId";
import { useOrdersRealtime } from "@/lib/useOrdersRealtime";
import { formatCurrency, formatAgo } from "@/lib/format";
import {
  IconRupee,
  IconBag,
  IconReceipt,
  IconChart,
  IconBox,
  IconQr,
} from "@/components/icons";
import { NoStoreState } from "@/components/NoStoreState";

export const Route = createFileRoute("/_auth/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const storeId = useActiveStoreId();
  if (!storeId) return <NoStoreState />;
  return <DashboardInner storeId={storeId} />;
}

function DashboardInner({ storeId }: { storeId: string }) {
  // Realtime channel keeps the numbers live (route-scoped — one channel per
  // owner tab); the interval is the safety net if the socket drops.
  useOrdersRealtime(storeId);
  const q = useQuery({
    queryKey: dashboardKeys.summary(storeId),
    queryFn: () => dashboardRepo.summary(storeId, "today"),
    staleTime: 0,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  const store = useQuery({
    queryKey: storeKeys.detail(storeId),
    queryFn: () => storesRepo.get(storeId),
    staleTime: 60_000,
  });
  const live = useQuery({
    queryKey: orderKeys.active(storeId),
    queryFn: () => ordersRepo.listActive(storeId),
    refetchInterval: 30_000,
  });

  const s = q.data;
  const menu = s?.menu;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl">
      {/* Welcome header + quick actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold">
            Welcome back, {store.data?.name ?? "…"} <span aria-hidden>👋</span>
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Here's what's happening at your cart today.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link to="/qr" className="btn btn-outline">
            <IconQr /> View QR
          </Link>
          <Link to="/orders/live" className="btn btn-outline">
            <IconReceipt /> Live Orders
          </Link>
          <Link to="/orders/new" className="btn btn-primary">
            + New Order
          </Link>
        </div>
      </div>

      {q.isLoading ? (
        <SkeletonGrid />
      ) : q.error ? (
        <ErrorState message={(q.error as Error).message} />
      ) : s ? (
        <>
          <section>
            <SectionLabel>Today</SectionLabel>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Stat
                icon={<IconRupee />}
                label="Revenue"
                value={formatCurrency(s.revenue)}
                hint={`${s.completedCount} completed`}
              />
              <Stat
                icon={<IconBag />}
                label="Orders"
                value={s.orderCount}
                hint="placed today"
              />
              <Stat
                icon={<IconReceipt />}
                label="Active"
                value={s.activeCount}
                hint="in the kitchen"
              />
              <Stat
                icon={<IconChart />}
                label="Completed"
                value={s.completedCount}
                hint="orders today"
              />
            </div>
          </section>

          {menu ? (
            <section>
              <SectionLabel>Menu</SectionLabel>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Stat
                  icon={<IconBox />}
                  label="Total Products"
                  value={menu.totalProducts}
                  hint={`${menu.available} available`}
                />
                <Stat
                  icon={<IconBox />}
                  label="Unavailable"
                  value={menu.unavailable}
                  hint="hidden from menu"
                />
                <Stat
                  icon={<IconBox />}
                  label="Low Stock"
                  value={menu.lowStock}
                  hint="near threshold"
                />
                <Stat
                  icon={<IconBox />}
                  label="Out of Stock"
                  value={menu.outOfStock}
                  hint="need refill"
                />
              </div>
            </section>
          ) : null}

          <div className="grid lg:grid-cols-2 gap-4">
            {/* Live orders preview */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold">Live Orders</h2>
                <Link to="/orders/live" className="text-sm text-brand font-semibold">
                  View all ↗
                </Link>
              </div>
              {live.data?.length ? (
                <div className="space-y-3">
                  {live.data.slice(0, 4).map((o) => (
                    <div key={o.id} className="flex items-center gap-3 text-sm">
                      <span className="badge bg-brand-soft text-brand">{o.status}</span>
                      <span className="font-semibold tabular-nums">#{o.order_number}</span>
                      <span className="text-neutral-500 flex-1 truncate">
                        {o.items?.map((i) => `${i.quantity}× ${i.product_name}`).join(", ")}
                      </span>
                      <span className="text-xs text-neutral-400">{formatAgo(o.created_at)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-neutral-500">
                  No active orders — new orders appear here the moment a customer
                  scans your QR.
                </p>
              )}
            </div>

            {/* Top items */}
            <div className="card p-5">
              <h2 className="font-bold mb-4">Top Items</h2>
              {s.topProducts.length ? (
                <div className="space-y-3">
                  {s.topProducts.slice(0, 5).map((p, i) => (
                    <div key={`${p.product_id ?? "row"}-${i}`} className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-md bg-neutral-100 text-neutral-500 text-xs grid place-items-center font-bold">
                        {i + 1}
                      </div>
                      <div className="flex-1 truncate text-sm font-medium">{p.name}</div>
                      <div className="text-xs text-neutral-500">×{p.qty}</div>
                      <div className="text-sm font-bold tabular-nums">
                        {formatCurrency(p.revenue)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-neutral-500">
                  Complete a few orders and your best-sellers show up here.
                </p>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-bold tracking-widest text-neutral-500 uppercase mb-2.5">
      {children}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="card p-4">
      <div className="stat-icon mb-3">{icon}</div>
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="text-2xl font-extrabold mt-0.5 tabular-nums">{value}</div>
      {hint ? <div className="text-xs text-neutral-400 mt-0.5">{hint}</div> : null}
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="card p-4 animate-pulse">
          <div className="w-9 h-9 rounded-xl bg-neutral-100" />
          <div className="h-3 bg-neutral-100 rounded w-1/2 mt-3" />
          <div className="h-6 bg-neutral-100 rounded w-3/4 mt-2" />
        </div>
      ))}
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="card p-4 border-red-200 bg-red-50 text-red-700 text-sm">{message}</div>
  );
}
