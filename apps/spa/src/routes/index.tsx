import { Link, createFileRoute } from "@tanstack/react-router";
import { useSessionSelector } from "@/lib/useSessionSelector";
import {
  IconQr,
  IconPrinter,
  IconChart,
  IconChefHat,
  IconRupee,
} from "@/components/icons";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

const FEATURES = [
  {
    icon: IconQr,
    title: "QR Table Ordering",
    body: "Customers scan, pick, and confirm in seconds. Your kitchen gets notified without a single shout.",
  },
  {
    icon: IconChart,
    title: "Live Revenue Dashboard",
    body: "Sales, orders, and bestsellers updating in real time — from any device, anywhere.",
  },
  {
    icon: IconRupee,
    title: "Instant Counter Billing",
    body: "Walk-in customer? Tap the items, save — billed and in your reports in under five seconds.",
  },
  {
    icon: IconPrinter,
    title: "Kitchen Display Board",
    body: "Your cooks see new orders the moment they come in. No paper slips. No mix-ups.",
  },
] as const;

const STEPS = [
  {
    title: "Build Your Menu",
    body: "Add dishes and prices in minutes. No tech skills required.",
  },
  {
    title: "Place Your QR Code",
    body: "Print your unique QR, stick it at the counter or table, and you're live.",
  },
  {
    title: "Watch Orders Roll In",
    body: "Every order lands on your dashboard and kitchen board instantly.",
  },
  {
    title: "Grow with Data",
    body: "Daily, weekly, monthly reports that show exactly what's working.",
  },
] as const;

const PLAN_FEATURES = [
  "Unlimited QR orders",
  "Live kitchen board",
  "Counter billing (New Order)",
  "Reports & CSV export",
  "UPI payments",
  "Tamil + English menus",
] as const;

function LandingPage() {
  const authed = useSessionSelector((s) => s.status === "authenticated");

  return (
    <div className="min-h-full">
      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <header className="max-w-6xl mx-auto px-4 md:px-6 h-20 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-brand grid place-items-center text-white shadow-glow">
            <IconChefHat width={24} height={24} />
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
          <a href="#pricing" className="hover:text-neutral-900">Pricing</a>
        </nav>
        <Link to={authed ? "/dashboard" : "/login"} className="btn btn-primary rounded-full !px-5">
          Dashboard <span aria-hidden>→</span>
        </Link>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 md:px-6 pt-12 md:pt-20 pb-10 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm text-neutral-600">
          <span className="text-brand">✦</span> Tamil Nadu’s modern shop OS
        </div>
        <h1 className="mt-8 text-5xl md:text-7xl font-extrabold leading-[1.04] tracking-tight text-balance">
          Run your stall
          <br />
          <span className="text-brand">like a pro.</span>
        </h1>
        <p className="mt-6 text-lg text-neutral-600 max-w-2xl mx-auto">
          From QR orders to live kitchen boards to GST invoices — everything
          your food stall, push cart, or cloud kitchen needs in one clean
          dashboard.
        </p>
        <div className="mt-8 flex flex-wrap gap-3 justify-center">
          <Link to="/signup" className="btn btn-primary rounded-full !px-6 !py-3 text-base">
            Start free <span aria-hidden>→</span>
          </Link>
          <Link to="/login" className="btn btn-outline rounded-full !px-6 !py-3 text-base">
            I already have an account
          </Link>
        </div>
        <div className="mt-10 flex gap-10 justify-center">
          <HeroStat n="₹0" label="Setup cost" />
          <HeroStat n="60s" label="To go live" />
          <HeroStat n="24/7" label="QR ordering" />
        </div>
      </section>

      {/* ── Hero screenshot — the real dashboard ─────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 md:px-6 pb-16">
        <BrowserFrame url="virundhu.app/dashboard">
          <img
            src="/landing/dashboard.png"
            alt="Virundhu owner dashboard — today's revenue, orders, kitchen queue and top items"
            className="w-full h-auto block"
            loading="eager"
            decoding="async"
            fetchPriority="high"
          />
        </BrowserFrame>
      </section>

      {/* ── Features ────────────────────────────────────────────────────── */}
      <section id="features" className="max-w-6xl mx-auto px-4 md:px-6 py-16 text-center">
        <div className="text-xs font-bold tracking-widest text-brand">EVERYTHING YOU NEED</div>
        <h2 className="mt-2 text-3xl md:text-4xl font-extrabold">Built for the way you cook</h2>
        <p className="mt-3 text-neutral-500 max-w-xl mx-auto">
          No IT degree. No complicated setup. Just powerful tools that work as
          hard as you do.
        </p>
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-left">
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

      {/* ── Product tour — real screenshots ─────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 md:px-6 py-16 space-y-16">
        <TourRow
          eyebrow="LIVE KITCHEN BOARD"
          title="Orders flow New → Preparing → Ready"
          body="One tap moves an order to the kitchen. Every card shows exactly what to cook, who ordered, and how long they've waited — updated in real time on every device."
          shot="/landing/live-orders.png"
          alt="Live Orders kitchen board with New, Preparing and Ready columns"
          url="virundhu.app/orders/live"
        />
        <TourRow
          flip
          eyebrow="COUNTER BILLING"
          title="Walk-in customer? Three taps."
          body="Tap the items, hit Save — the order is billed, paid, and already counted in today's revenue. Built for the rush hour, no cart, no checkout ceremony."
          shot="/landing/new-order.png"
          alt="New Order counter billing screen with tappable product tiles and a running total"
          url="virundhu.app/orders/new"
        />
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <div className="max-w-md">
            <div className="text-xs font-bold tracking-widest text-brand">QR ORDERING</div>
            <h3 className="mt-2 text-2xl md:text-3xl font-extrabold text-balance">
              Customers order from their own phone
            </h3>
            <p className="mt-3 text-neutral-500">
              They scan the poster, browse your menu in Tamil or English, and
              pay by UPI or cash at pickup. No app install, no signup, no
              queue at the counter.
            </p>
          </div>
          <div className="mx-auto w-full max-w-[280px]">
            <div className="rounded-[2rem] border-4 border-neutral-200 overflow-hidden shadow-card bg-white">
              <img
                src="/landing/storefront.png"
                alt="Customer menu on a phone with Add buttons and a cart bar"
                className="w-full h-auto block"
                loading="lazy"
                decoding="async"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────────── */}
      <section id="how-it-works" className="max-w-6xl mx-auto px-4 md:px-6 py-16 text-center">
        <div className="text-xs font-bold tracking-widest text-brand">SIMPLE ONBOARDING</div>
        <h2 className="mt-2 text-3xl md:text-4xl font-extrabold">Up and running in 4 steps</h2>
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-left">
          {STEPS.map((s, i) => (
            <div key={s.title} className="card p-5">
              <div className="text-5xl font-extrabold text-brand/25 tabular-nums leading-none">
                0{i + 1}
              </div>
              <div className="mt-4 font-semibold">{s.title}</div>
              <p className="mt-1.5 text-sm text-neutral-500">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Testimonial + guarantees ─────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 md:px-6 py-16">
        <div className="rounded-3xl bg-gradient-to-br from-brand-soft to-neutral-100 border border-neutral-200 p-8 md:p-12 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="text-amber-800 text-lg tracking-wider" aria-label="5 star rating">
              ★★★★★
            </div>
            <blockquote className="mt-4 text-2xl md:text-3xl font-extrabold leading-snug text-balance">
              “Before Virundhu, I wrote orders on paper and lost track
              constantly. Now I manage everything from my phone — even when
              I'm buying stock at the market.”
            </blockquote>
            <div className="mt-5 font-semibold">Murugan K.</div>
            <div className="text-sm text-neutral-500">Street food stall owner, Madurai</div>
          </div>
          <div className="space-y-3">
            <Benefit
              title="Free to start — no credit card"
              body="Your first 7 days are completely free."
            />
            <Benefit
              title="Works even with slow internet"
              body="Orders still go through. No excuses."
            />
            <Benefit
              title="Tamil & English supported"
              body="Use the app in the language you think in."
            />
          </div>
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────────────────── */}
      <section id="pricing" className="max-w-6xl mx-auto px-4 md:px-6 py-16 text-center">
        <div className="text-xs font-bold tracking-widest text-brand">SIMPLE PRICING</div>
        <h2 className="mt-2 text-3xl md:text-4xl font-extrabold">One plan. Everything included.</h2>
        <p className="mt-3 text-neutral-500 max-w-xl mx-auto">
          Every plan unlocks the full product today — feature tiers may come
          later, early vendors keep what they have.
        </p>
        <div className="mt-10 grid md:grid-cols-3 gap-4 text-left items-stretch">
          <PriceCard
            name="Free Trial"
            price="₹0"
            per="for 7 days"
            note="Full access. No credit card."
            cta="Start free"
          />
          <PriceCard
            name="Monthly"
            price="₹499"
            per="per month"
            note="Pay as you go. Cancel anytime."
            cta="Start free"
          />
          <PriceCard
            featured
            badge="SAVE 30%"
            name="Yearly"
            price="₹349"
            per="per month · billed ₹4,188/year"
            note="Two months+ free vs monthly."
            cta="Start free"
          />
        </div>
        <div className="mt-8 card p-5 max-w-3xl mx-auto">
          <div className="text-sm font-bold mb-3">Every plan includes</div>
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 text-sm text-neutral-600 text-left">
            {PLAN_FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2">
                <span className="text-emerald-600" aria-hidden>✓</span> {f}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-4 md:px-6 py-20 text-center">
        <div className="text-xs font-bold tracking-widest text-brand">READY TO GROW?</div>
        <h2 className="mt-3 text-4xl md:text-5xl font-extrabold text-balance">
          Your stall deserves a smarter system.
        </h2>
        <p className="mt-4 text-lg text-neutral-500 max-w-xl mx-auto">
          Join 50+ vendors who swapped notebooks for real-time dashboards.
          Setup takes under 10 minutes.
        </p>
        <div className="mt-8 flex flex-wrap gap-3 justify-center">
          <Link to="/signup" className="btn btn-primary rounded-full !px-8 !py-3 text-base">
            Start free <span aria-hidden>→</span>
          </Link>
          <Link to="/login" className="btn btn-outline rounded-full !px-8 !py-3 text-base">
            I already have an account
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

function BrowserFrame({ url, children }: { url: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white shadow-glow overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-neutral-200 bg-neutral-100">
        <div className="flex gap-1.5" aria-hidden>
          <span className="w-2.5 h-2.5 rounded-full bg-red-600/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-800" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
        </div>
        <div className="flex-1 max-w-sm mx-auto rounded-md bg-white border border-neutral-200 px-3 py-1 text-[11px] text-neutral-400 text-center truncate">
          {url}
        </div>
      </div>
      {children}
    </div>
  );
}

function TourRow({
  eyebrow,
  title,
  body,
  shot,
  alt,
  url,
  flip,
}: {
  eyebrow: string;
  title: string;
  body: string;
  shot: string;
  alt: string;
  url: string;
  flip?: boolean;
}) {
  return (
    <div className="grid lg:grid-cols-5 gap-8 items-center">
      <div className={`lg:col-span-2 max-w-md ${flip ? "lg:order-2" : ""}`}>
        <div className="text-xs font-bold tracking-widest text-brand">{eyebrow}</div>
        <h3 className="mt-2 text-2xl md:text-3xl font-extrabold text-balance">{title}</h3>
        <p className="mt-3 text-neutral-500">{body}</p>
      </div>
      <div className={`lg:col-span-3 ${flip ? "lg:order-1" : ""}`}>
        <BrowserFrame url={url}>
          <img src={shot} alt={alt} className="w-full h-auto block" loading="lazy" decoding="async" />
        </BrowserFrame>
      </div>
    </div>
  );
}

function Benefit({ title, body }: { title: string; body: string }) {
  return (
    <div className="card !rounded-2xl p-4 flex gap-3 items-start">
      <span className="w-6 h-6 shrink-0 rounded-full bg-emerald-100 text-emerald-600 grid place-items-center text-sm" aria-hidden>
        ✓
      </span>
      <div>
        <div className="font-semibold text-sm">{title}</div>
        <div className="text-sm text-neutral-500 mt-0.5">{body}</div>
      </div>
    </div>
  );
}

function PriceCard({
  name,
  price,
  per,
  note,
  cta,
  featured,
  badge,
}: {
  name: string;
  price: string;
  per: string;
  note: string;
  cta: string;
  featured?: boolean;
  badge?: string;
}) {
  return (
    <div
      className={`card p-6 flex flex-col relative ${
        featured ? "border-brand shadow-glow" : ""
      }`}
    >
      {badge ? (
        <span className="absolute -top-3 right-4 badge bg-brand text-white">{badge}</span>
      ) : null}
      <div className="font-semibold">{name}</div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-4xl font-extrabold tabular-nums">{price}</span>
      </div>
      <div className="text-sm text-neutral-500 mt-1">{per}</div>
      <div className="text-sm text-neutral-500 mt-3 flex-1">{note}</div>
      <Link
        to="/signup"
        className={`btn mt-5 w-full ${featured ? "btn-primary" : "btn-outline"}`}
      >
        {cta}
      </Link>
    </div>
  );
}
