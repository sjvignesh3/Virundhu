import Link from "next/link";
import {
  ArrowUpRight,
  ClipboardList,
  IndianRupee,
  Plus,
  ShoppingBag,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/owner/page-header";
import { formatCurrency, cn } from "@/lib/utils";

const stats = [
  {
    label: "Today's Revenue",
    value: formatCurrency(4820),
    delta: "+12.4%",
    trend: "up" as const,
    icon: IndianRupee,
  },
  {
    label: "Orders Today",
    value: "42",
    delta: "+8",
    trend: "up" as const,
    icon: ShoppingBag,
  },
  {
    label: "In Kitchen",
    value: "6",
    delta: "3 new",
    trend: "flat" as const,
    icon: ClipboardList,
  },
  {
    label: "Unique Customers",
    value: "28",
    delta: "+5",
    trend: "up" as const,
    icon: Users,
  },
];

const liveOrders = [
  { id: "#A-102", items: "2× Idli, 1× Filter Coffee", status: "new", time: "2m ago", total: 180 },
  { id: "#A-101", items: "1× Masala Dosa, 1× Vada", status: "cooking", time: "6m ago", total: 220 },
  { id: "#A-100", items: "3× Parotta, 1× Chicken Curry", status: "ready", time: "9m ago", total: 340 },
];

const statusStyles: Record<string, string> = {
  new: "bg-info/10 text-info border-info/20",
  cooking: "bg-warning/10 text-warning border-warning/20",
  ready: "bg-success/10 text-success border-success/20",
};

const topItems = [
  { name: "Masala Dosa", qty: 18, revenue: 2160 },
  { name: "Filter Coffee", qty: 24, revenue: 720 },
  { name: "Parotta", qty: 15, revenue: 750 },
  { name: "Idli (2pc)", qty: 22, revenue: 1100 },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Good morning, Vignesh 👋"
        description="Here's what's happening at your cart today."
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/orders/live">
                <ClipboardList className="mr-2 h-4 w-4" />
                Live Orders
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/products">
                <Plus className="mr-2 h-4 w-4" />
                Add Product
              </Link>
            </Button>
          </>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="overflow-hidden">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-start justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <span
                    className={cn(
                      "flex items-center gap-0.5 text-xs font-medium",
                      s.trend === "up" ? "text-success" : "text-muted-foreground",
                    )}
                  >
                    {s.trend === "up" && <TrendingUp className="h-3 w-3" />}
                    {s.delta}
                  </span>
                </div>
                <div className="mt-3">
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="mt-0.5 text-xl font-bold sm:text-2xl">{s.value}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Live orders */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base">Live Orders</CardTitle>
              <CardDescription>Currently in kitchen</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/orders/live">
                View all
                <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y">
              {liveOrders.map((order) => (
                <li
                  key={order.id}
                  className="flex items-center gap-3 px-6 py-3 transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{order.id}</span>
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                          statusStyles[order.status],
                        )}
                      >
                        {order.status}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {order.items}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">
                      {formatCurrency(order.total)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {order.time}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Top items */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Top Items Today</CardTitle>
            <CardDescription>By quantity sold</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {topItems.map((item, idx) => {
              const max = topItems[0].qty;
              const pct = (item.qty / max) * 100;
              return (
                <div key={item.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded bg-muted text-[10px] font-semibold text-muted-foreground">
                        {idx + 1}
                      </span>
                      <span className="font-medium">{item.name}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {item.qty} sold
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Card className="border-dashed">
        <CardContent className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">Preview data</p>
            <p className="text-xs text-muted-foreground">
              Numbers shown are placeholders. Real data will connect in the orders + reports steps.
            </p>
          </div>
          <Badge variant="warning">Demo</Badge>
        </CardContent>
      </Card>
    </div>
  );
}
