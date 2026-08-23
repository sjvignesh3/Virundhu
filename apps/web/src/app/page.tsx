import Link from "next/link";
import {
  ArrowRight,
  ShoppingBag,
  Sparkles,
  QrCode,
  Printer,
  BarChart3,
  Flame,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Marketing landing page.
 *
 * Dark hero on the left (bold headline + tagline chip + CTAs) paired with a
 * mock "Shop Owner Panel" preview on the right — inspired by the Kari Kadai
 * reference. Palette re-uses our existing curry-orange primary token so the
 * marketing surface stays cohesive with the owner console.
 */
export default function Home() {
  return (
    <main className="min-h-screen bg-[hsl(20_14%_8%)] text-[hsl(40_33%_96%)]">
      {/* Top nav */}
      <header className="border-b border-white/5">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-[hsl(12_92%_48%)] shadow-lg shadow-primary/30">
              <ShoppingBag className="h-6 w-6 text-white" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-lg font-bold tracking-wide">VIRUNDHU</span>
              <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/50">
                விருந்து · Order &amp; Ops
              </span>
            </div>
          </Link>

          <nav className="hidden items-center gap-8 text-sm text-white/70 md:flex">
            <a href="#features" className="transition hover:text-white">
              Features
            </a>
            <a href="#how" className="transition hover:text-white">
              How it works
            </a>
            <a href="#preview" className="transition hover:text-white">
              Dashboard Demo
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <Button
              asChild
              className="rounded-full bg-gradient-to-r from-primary to-[hsl(12_92%_48%)] px-5 text-white shadow-lg shadow-primary/30 hover:opacity-95"
            >
              <Link href="/login">
                Dashboard <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Ambient glows */}
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-primary/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 top-40 h-80 w-80 rounded-full bg-[hsl(12_92%_48%)]/15 blur-3xl"
        />

        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 md:grid-cols-2 md:px-8 md:py-24">
          {/* Left column — copy */}
          <div className="flex flex-col justify-center">
            <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 backdrop-blur">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>Tamil Nadu&rsquo;s modern shop OS</span>
            </div>

            <h1 className="text-balance text-5xl font-extrabold leading-[1.05] tracking-tight md:text-6xl lg:text-7xl">
              Your Shop,
              <br />
              <span className="bg-gradient-to-r from-primary via-[hsl(18_95%_55%)] to-[hsl(12_92%_48%)] bg-clip-text text-transparent">
                Fully Digital
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/70">
              Virundhu is the all-in-one platform for food stalls, meat shops
              and small kitchens. Take QR orders, run the live kitchen board,
              print GST bills, and understand your business — all from one
              dashboard.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="rounded-full bg-gradient-to-r from-primary to-[hsl(12_92%_48%)] px-7 text-base text-white shadow-xl shadow-primary/30 hover:opacity-95"
              >
                <Link href="/signup">
                  Start free <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-full border-white/20 bg-transparent px-7 text-base text-white hover:bg-white/10 hover:text-white"
              >
                <Link href="/login">I already have an account</Link>
              </Button>
            </div>

            <div className="mt-10 grid grid-cols-3 gap-6 border-t border-white/10 pt-8 text-sm">
              <Stat value="₹0" label="Setup cost" />
              <Stat value="60s" label="To go live" />
              <Stat value="24/7" label="QR ordering" />
            </div>
          </div>

          {/* Right column — mock dashboard preview */}
          <div id="preview" className="flex items-center">
            <DashboardMock />
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-white/5 bg-white/[0.02]">
        <div className="mx-auto max-w-7xl px-4 py-20 md:px-8">
          <div className="mb-12 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
              Everything included
            </p>
            <h2 className="mt-3 text-3xl font-bold md:text-4xl">
              Built for busy kitchens
            </h2>
          </div>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            <FeatureCard
              icon={<QrCode className="h-5 w-5" />}
              title="QR menu ordering"
              body="Customers scan and order in seconds. No app install, no signup."
            />
            <FeatureCard
              icon={<Flame className="h-5 w-5" />}
              title="Live kitchen board"
              body="Orders flow through NEW → PREPARING → READY in real time."
            />
            <FeatureCard
              icon={<Printer className="h-5 w-5" />}
              title="Bill &amp; kitchen prints"
              body="Configure printers per station. Kitchen and customer copies."
            />
            <FeatureCard
              icon={<BarChart3 className="h-5 w-5" />}
              title="Reports that matter"
              body="Daily revenue, top items, and CSV exports for your accountant."
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-t border-white/5">
        <div className="mx-auto max-w-5xl px-4 py-20 md:px-8">
          <div className="mb-12 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
              How it works
            </p>
            <h2 className="mt-3 text-3xl font-bold md:text-4xl">
              Live in three steps
            </h2>
          </div>

          <ol className="space-y-6">
            <Step
              n={1}
              title="Create your account"
              body="Sign up as an owner and give your shop a name and URL — no credit card needed."
            />
            <Step
              n={2}
              title="Add your menu &amp; print your QR"
              body="Enter categories, products and prices. Print the poster and stick it on your counter."
            />
            <Step
              n={3}
              title="Take orders and grow"
              body="Watch orders roll into the live board, print bills, and track your revenue in reports."
            />
          </ol>

          <div className="mt-12 flex justify-center">
            <Button
              asChild
              size="lg"
              className="rounded-full bg-gradient-to-r from-primary to-[hsl(12_92%_48%)] px-8 text-base text-white shadow-xl shadow-primary/30 hover:opacity-95"
            >
              <Link href="/signup">
                Get started <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/5 py-8 text-center text-xs text-white/40">
        <p>© {new Date().getFullYear()} Virundhu · Made for Tamil kitchens</p>
      </footer>
    </main>
  );
}

/* ------------------------------ helpers ------------------------------ */

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wider text-white/50">
        {label}
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="group rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-primary/40 hover:bg-white/[0.06]">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary transition group-hover:bg-primary/25">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-white/60">{body}</p>
    </div>
  );
}

function Step({
  n,
  title,
  body,
}: {
  n: number;
  title: string;
  body: string;
}) {
  return (
    <li className="flex gap-5 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-[hsl(12_92%_48%)] text-lg font-bold text-white shadow-lg shadow-primary/25">
        {n}
      </div>
      <div>
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-white/60">{body}</p>
      </div>
    </li>
  );
}

/**
 * Static, illustrative "Shop Owner Panel" preview. No real data — pure
 * marketing decoration inspired by the Kari Kadai reference screenshot.
 */
function DashboardMock() {
  return (
    <div className="w-full rounded-3xl border border-white/10 bg-[hsl(20_14%_11%)] p-5 shadow-2xl shadow-black/40 backdrop-blur">
      {/* Chrome */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
          <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
          <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/60">
          Shop Owner Panel
        </span>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <div className="text-xs text-white/50">Today&rsquo;s Orders</div>
          <div className="mt-2 flex items-baseline justify-between">
            <div className="text-3xl font-bold text-white">47</div>
            <span className="text-xs font-semibold text-emerald-400">+15%</span>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <div className="text-xs text-white/50">Today&rsquo;s Revenue</div>
          <div className="mt-2 flex items-baseline justify-between">
            <div className="text-3xl font-bold text-white">₹12,450</div>
            <span className="text-xs font-semibold text-emerald-400">+8%</span>
          </div>
        </div>
      </div>

      {/* Live orders */}
      <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold text-white">Live QR Orders</div>
          <Zap className="h-4 w-4 text-primary" />
        </div>
        <ul className="space-y-2.5 text-sm">
          <LiveRow name="Chicken Biryani" qty="2" price="₹560" />
          <LiveRow name="Parotta &amp; Salna" qty="4" price="₹320" />
          <LiveRow name="Filter Coffee" qty="3" price="₹150" />
        </ul>
      </div>

      {/* Alert */}
      <div className="mt-4 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-200/90">
        <span className="font-semibold">⚠ Low Stock:</span> Parotta — only 6
        left. Restock today!
      </div>
    </div>
  );
}

function LiveRow({
  name,
  qty,
  price,
}: {
  name: string;
  qty: string;
  price: string;
}) {
  return (
    <li className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-emerald-400" />
        <span className="text-white">{name}</span>
        <span className="text-white/40">·</span>
        <span className="text-white/50">{qty}</span>
      </div>
      <span className="font-semibold text-primary">{price}</span>
    </li>
  );
}
