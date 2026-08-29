import { Link, createFileRoute } from "@tanstack/react-router";
import { useSessionSelector } from "@/lib/useSessionSelector";
import {
  IconQr,
  IconReceipt,
  IconPrinter,
  IconChart,
  IconZap,
} from "@/components/icons";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

const FEATURES = [
  {
    icon: IconQr,
    title: "QR menu ordering",
    body: "Customers scan and order in seconds. No app install, no signup.",
  },
  {
    icon: IconReceipt,
    title: "Live kitchen board",
    body: "Orders flow through NEW → PREPARING → READY in real time.",
  },
  {
    icon: IconPrinter,
    title: "Bill & kitchen prints",
    body: "Configure printers per station. Kitchen and customer copies.",
  },
  {
    icon: IconChart,
    title: "Reports that matter",
    body: "Daily revenue, top items, and CSV exports for your accountant.",
  },
] as const;

const STEPS = [
  {
    title: "Create your account",
    body: "Sign up as an owner and give your shop a name and URL — no credit card needed.",
  },
  {
    title: "Add your menu & print your QR",
    body: "Enter categories, products and prices. Print the poster and stick it on your counter.",
  },
  {
    title: "Take orders and grow",
    body: "Watch orders roll into the live board, print bills, and track your revenue in reports.",
  },
] as const;

function LandingPage() {
  const authed = useSessionSelector((s) => s.status === "authenticated");

  return (
    <div className="min-h-full">
      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <header className="max-w-6xl mx-auto px-4 md:px-6 h-20 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-brand grid place-items-center text-white font-bold text-xl shadow-glow">
            வி
          </div>
          <div className="leading-tight">
            <div className="font-extrabold tracking-wide">VIRUNDHU</div>
            <div className="text-[11px] text-neutral-500 tracking-widest">
              விருந்து · ORDER &amp; OPS
            </div>
          </div>
        </div>
        <nav className="hidden md:flex items-center gap-8 text-sm text-neutral-600">
          <a href="#features" className="hover:text-neutral-900">Features</a>
          <a href="#how-it-works" className="hover:text-neutral-900">How it works</a>
          <a href="#demo" className="hover:text-neutral-900">Dashboard Demo</a>
        </nav>
        <Link to={authed ? "/dashboard" : "/login"} className="btn btn-primary rounded-full !px-5">
          Dashboard <span aria-hidden>→</span>
        </Link>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 md:px-6 pt-10 md:pt-20 pb-16 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm text-neutral-600">
            <span className="text-brand">✦</span> Tamil Nadu’s modern shop OS
          </div>
          <h1 className="mt-8 text-5xl md:text-7xl font-extrabold leading-[1.02] tracking-tight">
            Your Shop,
            <br />
            <span className="text-brand">Fully Digital</span>
          </h1>
          <p className="mt-6 text-lg text-neutral-600 max-w-xl">
            Virundhu is the all-in-one platform for food stalls, meat shops and
            small kitchens. Take QR orders, run the live kitchen board, print
            GST bills, and understand your business — all from one dashboard.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/signup" className="btn btn-primary rounded-full !px-6 !py-3 text-base">
              Start free <span aria-hidden>→</span>
            </Link>
            <Link to="/login" className="btn btn-outline rounded-full !px-6 !py-3 text-base">
              I already have an account
            </Link>
          </div>
          <div className="mt-10 pt-8 border-t border-neutral-200 flex gap-10">
            <HeroStat n="₹0" label="Setup cost" />
            <HeroStat n="60s" label="To go live" />
            <HeroStat n="24/7" label="QR ordering" />
          </div>
        </div>

        {/* Demo dashboard card */}
        <div id="demo" className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-600/80" />
              <span className="w-3 h-3 rounded-full bg-amber-800" />
              <span className="w-3 h-3 rounded-full bg-emerald-600" />
            </div>
            <span className="badge border border-neutral-200 text-neutral-500 tracking-widest">
              SHOP OWNER PANEL
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <DemoStat label="Today’s Orders" value="47" delta="+15%" />
            <DemoStat label="Today’s Revenue" value="₹12,450" delta="+8%" />
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-neutral-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold">Live QR Orders</div>
              <IconZap className="text-brand" />
            </div>
            <DemoOrder name="Chicken Biryani" qty={2} amount="₹560" />
            <DemoOrder name="Parotta & Salna" qty={4} amount="₹320" />
            <DemoOrder name="Filter Coffee" qty={3} amount="₹150" />
          </div>
          <div className="rounded-xl border border-amber-800/40 bg-amber-100 px-4 py-3 text-sm text-amber-800">
            ⚠ <strong>Low Stock:</strong> Parotta — only 6 left. Restock today!
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────────── */}
      <section id="features" className="max-w-6xl mx-auto px-4 md:px-6 py-16">
        <div className="text-xs font-bold tracking-widest text-brand">EVERYTHING INCLUDED</div>
        <h2 className="mt-2 text-3xl md:text-4xl font-extrabold">Built for busy kitchens</h2>
        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="card p-5">
              <div className="stat-icon mb-4">
                <f.icon />
              </div>
              <div className="font-semibold">{f.title}</div>
              <p className="mt-1.5 text-sm text-neutral-500">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────────── */}
      <section id="how-it-works" className="max-w-6xl mx-auto px-4 md:px-6 py-16">
        <div className="text-xs font-bold tracking-widest text-brand">HOW IT WORKS</div>
        <h2 className="mt-2 text-3xl md:text-4xl font-extrabold">Live in three steps</h2>
        <div className="mt-8 grid md:grid-cols-3 gap-4">
          {STEPS.map((s, i) => (
            <div key={s.title} className="card p-5">
              <div className="w-9 h-9 rounded-full bg-brand text-white font-bold grid place-items-center">
                {i + 1}
              </div>
              <div className="mt-4 font-semibold">{s.title}</div>
              <p className="mt-1.5 text-sm text-neutral-500">{s.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 text-center">
          <Link to="/signup" className="btn btn-primary rounded-full !px-8 !py-3 text-base">
            Get started
          </Link>
        </div>
      </section>

      <footer className="border-t border-neutral-200 py-8 text-center text-sm text-neutral-500">
        © 2026 Virundhu · Made for Tamil kitchens
      </footer>
    </div>
  );
}

function HeroStat({ n, label }: { n: string; label: string }) {
  return (
    <div>
      <div className="text-2xl font-extrabold text-brand">{n}</div>
      <div className="text-[11px] tracking-widest text-neutral-500 uppercase">{label}</div>
    </div>
  );
}

function DemoStat({ label, value, delta }: { label: string; value: string; delta: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-100 p-4">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="flex items-end justify-between mt-1">
        <div className="text-3xl font-extrabold tabular-nums">{value}</div>
        <div className="text-xs font-bold text-emerald-600">{delta}</div>
      </div>
    </div>
  );
}

function DemoOrder({ name, qty, amount }: { name: string; qty: number; amount: string }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-neutral-200 last:border-0 text-sm">
      <span className="w-2 h-2 rounded-full bg-emerald-600" />
      <span className="font-medium flex-1">
        {name} <span className="text-neutral-400 font-normal">· {qty}</span>
      </span>
      <span className="font-semibold text-brand tabular-nums">{amount}</span>
    </div>
  );
}
