/**
 * Public storefront — /order/:slug (the URL printed on QR posters; kept
 * byte-identical to the legacy product so existing posters keep working).
 * /menu/:slug redirects here for links minted by earlier builds.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { publicMenuKeys, publicMenuRepo, ordersRepo } from "@virundhu/client";
import type { PublicMenuProduct, PublicMenuStore } from "@virundhu/client";
import type { ActivePaymentMethod } from "@virundhu/shared";
import { cartStore, useCart, cartSubtotal, cartCount } from "@/lib/cart";
import { formatCurrency } from "@/lib/format";
import { buildUpiIntentUrl } from "@/lib/upi";
import { cn } from "@/lib/cn";

export const Route = createFileRoute("/order/$slug")({
  component: PublicMenuPage,
});

function PublicMenuPage() {
  const { slug } = Route.useParams();
  const q = useQuery({
    queryKey: publicMenuKeys.bySlug(slug),
    queryFn: () => publicMenuRepo.bySlug(slug),
    // Menu is served through the Vercel edge cache (Plan §4.1) — browser
    // caching for 5 min matches s-maxage and prevents extra fetches on
    // fast navigations back to the same slug.
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });

  useEffect(() => {
    cartStore.getState().setSlug(slug);
  }, [slug]);

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const count = useCart((s) => cartCount(s.lines));
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  if (q.isLoading) return <MenuSkeleton />;
  if (q.error || !q.data) {
    return (
      <div className="p-6 max-w-md mx-auto">
        <div className="card p-4 border-red-200 bg-red-50 text-red-700 text-sm">
          {(q.error as Error)?.message ?? "Menu not available"}
        </div>
      </div>
    );
  }

  const { store, categories } = q.data;
  const showTamil = store.settings.showTamilNames;
  const acceptOrders = store.settings.acceptOrders && store.status === "OPEN";
  const prepMins = store.settings.estimatedPreparationMinutes;

  function scrollToCat(id: string | null) {
    setActiveCat(id);
    if (id) sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
    else window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="min-h-full pb-28">
      {/* Hero — deliberately image-free: text renders instantly on 3G and
          there is no layout shift while a photo loads. */}
      <header className="relative overflow-hidden border-b border-neutral-200 bg-gradient-to-br from-brand-soft to-neutral-50">
        <div className="relative max-w-2xl mx-auto px-4 py-8 md:py-10">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-extrabold">{store.name}</h1>
              {showTamil && store.tamilName ? (
                <div className="text-sm text-neutral-500 mt-0.5">{store.tamilName}</div>
              ) : null}
              {prepMins ? (
                <div className="text-sm text-neutral-500 mt-2">
                  Typical prep time: ~{prepMins} min
                </div>
              ) : null}
            </div>
            <span
              className={cn(
                "badge",
                acceptOrders
                  ? "bg-emerald-100 text-emerald-600"
                  : "bg-amber-100 text-amber-800",
              )}
            >
              {acceptOrders ? "Open" : "Closed"}
            </span>
          </div>
        </div>
      </header>

      {/* Category chips */}
      <nav className="sticky top-0 z-20 bg-neutral-50/95 backdrop-blur border-b border-neutral-200">
        <div className="max-w-2xl mx-auto px-3 py-2.5 flex gap-2 overflow-x-auto">
          <CatChip label="All" active={activeCat === null} onClick={() => scrollToCat(null)} />
          {categories.map((c) => (
            <CatChip
              key={c.id}
              label={c.name}
              active={activeCat === c.id}
              onClick={() => scrollToCat(c.id)}
            />
          ))}
        </div>
      </nav>

      <main className="max-w-2xl mx-auto p-3 md:p-4 space-y-8 mt-2">
        {categories.map((cat) => (
          <section
            key={cat.id}
            ref={(el) => {
              sectionRefs.current[cat.id] = el;
            }}
            className="scroll-mt-16"
          >
            <h2 className="text-lg font-bold mb-3">
              {cat.name}
              {showTamil && cat.tamilName ? (
                <span className="text-sm text-neutral-500 font-normal ml-2">{cat.tamilName}</span>
              ) : null}
            </h2>
            <div className="grid gap-3">
              {cat.products.map((p) => (
                <ProductRow key={p.id} product={p} showTamil={showTamil} disabled={!acceptOrders} />
              ))}
            </div>
          </section>
        ))}
        {!acceptOrders ? (
          <div className="card p-4 text-sm text-amber-800 bg-amber-100 border-amber-800/30">
            This store isn’t accepting orders right now. You can browse the menu
            and come back later.
          </div>
        ) : null}
      </main>

      {count > 0 && acceptOrders ? (
        <div className="fixed inset-x-0 bottom-0 z-30 bg-neutral-50/95 backdrop-blur border-t border-neutral-200 p-3">
          <div className="max-w-2xl mx-auto">
            <button className="btn btn-primary w-full !py-3" onClick={() => setCheckoutOpen(true)}>
              View cart ({count})
            </button>
          </div>
        </div>
      ) : null}

      {checkoutOpen ? (
        <CheckoutSheet slug={slug} store={store} onClose={() => setCheckoutOpen(false)} />
      ) : null}
    </div>
  );
}

function CatChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border transition-colors",
        active
          ? "bg-brand text-white border-brand"
          : "border-neutral-200 text-neutral-600 hover:bg-neutral-100",
      )}
    >
      {label}
    </button>
  );
}

function MenuSkeleton() {
  return (
    <div className="min-h-full pb-24">
      <div className="border-b border-neutral-200">
        <div className="max-w-2xl mx-auto p-4 py-10 space-y-2">
          <div className="h-8 w-48 bg-neutral-200 rounded animate-pulse" />
          <div className="h-4 w-28 bg-neutral-200 rounded animate-pulse" />
        </div>
      </div>
      <main className="max-w-2xl mx-auto p-3 space-y-4 mt-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card p-3 h-24 animate-pulse" />
        ))}
      </main>
    </div>
  );
}

function ProductRow({
  product,
  showTamil,
  disabled,
}: {
  product: PublicMenuProduct;
  showTamil: boolean;
  disabled: boolean;
}) {
  const line = useCart((s) => s.lines.find((l) => l.productId === product.id));
  const qty = line?.quantity ?? 0;
  const add = cartStore.getState().add;
  const cartLine = {
    productId: product.id,
    name: product.name,
    tamilName: product.tamilName,
    unitPrice: product.price,
  };

  return (
    <div className={cn("card p-3.5 flex items-center gap-4", !product.isAvailable && "opacity-50")}>
      <div className="flex-1 min-w-0">
        <div className="font-semibold">{product.name}</div>
        {showTamil && product.tamilName ? (
          <div className="text-sm text-neutral-500">{product.tamilName}</div>
        ) : null}
        <div className="mt-1">
          <span className="font-bold text-lg tabular-nums">{formatCurrency(product.price)}</span>
          {product.unit ? (
            <span className="text-xs text-neutral-400 ml-1.5">per {product.unit}</span>
          ) : null}
        </div>
      </div>
      {product.isAvailable && !disabled ? (
        qty === 0 ? (
          <button className="btn btn-primary rounded-full !px-5" onClick={() => add(cartLine, 1)}>
            + Add
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              className="btn btn-outline rounded-full !text-base w-9 h-9 !p-0"
              aria-label={`Remove one ${product.name}`}
              onClick={() => add(cartLine, -1)}
            >
              −
            </button>
            <span className="w-6 text-center font-bold tabular-nums">{qty}</span>
            <button
              className="btn btn-outline rounded-full !text-base w-9 h-9 !p-0"
              aria-label={`Add one ${product.name}`}
              onClick={() => add(cartLine, 1)}
            >
              +
            </button>
          </div>
        )
      ) : (
        <span className="text-xs text-neutral-400">Unavailable</span>
      )}
    </div>
  );
}

function CheckoutSheet({
  slug,
  store,
  onClose,
}: {
  slug: string;
  store: PublicMenuStore;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const lines = useCart((s) => s.lines);
  const subtotal = useCart((s) => cartSubtotal(s.lines));
  const [customer, setCustomer] = useState({ name: "", phone: "" });
  const [notes, setNotes] = useState("");
  const upiAvailable = Boolean(store.upiId);
  const [paymentMethod, setPaymentMethod] = useState<ActivePaymentMethod>(
    upiAvailable ? "UPI" : "CASH",
  );
  const setQty = cartStore.getState().setQty;
  const removeLine = cartStore.getState().remove;

  const minOrder = store.settings.minimumOrderValue;
  const belowMinimum = useMemo(
    () => minOrder > 0 && subtotal < minOrder,
    [minOrder, subtotal],
  );

  const place = useMutation({
    mutationFn: () =>
      ordersRepo.createFromCart(store.id, {
        items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
        customer: {
          name: customer.name.trim() || undefined,
          phone: customer.phone.trim() || undefined,
        },
        notes: notes.trim() || undefined,
        paymentMethod,
      }),
    onSuccess: (order) => {
      toast.success(`Order #${order.order_number} placed!`);
      cartStore.getState().clear();

      // If the customer picked UPI, open the intent URL BEFORE navigating so
      // the click is still trusted (Safari/iOS ignore programmatic
      // `location.href` writes after a routing transition).
      if (paymentMethod === "UPI" && store.upiId) {
        const upiUrl = buildUpiIntentUrl({
          vpa: store.upiId,
          payeeName: store.name,
          amount: order.total_amount,
          orderNumber: order.order_number,
        });
        if (upiUrl) window.location.assign(upiUrl);
        else toast.error("Could not launch UPI app. Please pay by cash on pickup.");
      }

      onClose();
      navigate({
        to: "/order/$slug/success/$orderNumber",
        params: { slug, orderNumber: order.order_number },
      });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Order failed"),
  });

  const primaryLabel =
    paymentMethod === "UPI"
      ? `Pay ${formatCurrency(subtotal)} via UPI`
      : `Place order · Pay ${formatCurrency(subtotal)} in cash`;

  return (
    <div className="fixed inset-0 bg-black/60 grid place-items-end md:justify-items-end md:items-stretch z-50">
      <div className="bg-white border-l border-t md:border-t-0 border-neutral-200 w-full md:max-w-md md:h-full rounded-t-2xl md:rounded-none max-h-[92vh] md:max-h-full overflow-auto p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xl font-bold">Your order</h2>
          <button
            className="text-neutral-400 hover:text-neutral-700 text-lg"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <p className="text-sm text-neutral-500 mb-4">
          {cartCount(lines)} item{cartCount(lines) === 1 ? "" : "s"} from {store.name}.
        </p>

        <div className="space-y-3">
          {lines.map((l) => (
            <div key={l.productId} className="card !rounded-xl p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{l.name}</div>
                  <div className="text-xs text-neutral-500 mt-0.5">
                    {formatCurrency(l.unitPrice)} each
                  </div>
                </div>
                <div className="font-bold tabular-nums">
                  {formatCurrency(l.unitPrice * l.quantity)}
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 mt-2">
                <div className="flex items-center gap-2">
                  <button
                    className="btn btn-outline rounded-full w-7 h-7 !p-0 text-sm"
                    aria-label={`Reduce ${l.name}`}
                    onClick={() => setQty(l.productId, l.quantity - 1)}
                  >
                    −
                  </button>
                  <span className="w-5 text-center text-sm font-semibold tabular-nums">
                    {l.quantity}
                  </span>
                  <button
                    className="btn btn-outline rounded-full w-7 h-7 !p-0 text-sm"
                    aria-label={`Increase ${l.name}`}
                    onClick={() => setQty(l.productId, l.quantity + 1)}
                  >
                    +
                  </button>
                </div>
                <button
                  className="text-xs text-neutral-400 hover:text-red-700"
                  onClick={() => removeLine(l.productId)}
                >
                  🗑 Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="py-4 flex items-center justify-between font-bold">
          <span>Subtotal</span>
          <span className="tabular-nums">{formatCurrency(subtotal)}</span>
        </div>
        {belowMinimum ? (
          <div className="mb-3 rounded-xl bg-amber-100 text-amber-800 text-sm px-3.5 py-2.5">
            Minimum order is {formatCurrency(minOrder)} — add{" "}
            {formatCurrency(minOrder - subtotal)} more to place this order.
          </div>
        ) : null}

        <div className="space-y-3">
          <Field label="Name (optional)">
            <input
              className="input"
              placeholder="e.g. Ravi"
              value={customer.name}
              onChange={(e) => setCustomer((c) => ({ ...c, name: e.target.value }))}
            />
          </Field>
          <Field label="Phone (optional)">
            <input
              className="input"
              placeholder="+91 90000 00000"
              value={customer.phone}
              onChange={(e) => setCustomer((c) => ({ ...c, phone: e.target.value }))}
            />
          </Field>
          <Field label="Note (optional)">
            <textarea
              className="input min-h-[64px]"
              placeholder="e.g. Less spicy"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
        </div>

        <fieldset className="mt-4 space-y-2">
          <legend className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Payment</legend>
          <PaymentOption
            id="pm-cash"
            label="Pay by cash on pickup"
            hint="Show your order number at the counter."
            checked={paymentMethod === "CASH"}
            onChange={() => setPaymentMethod("CASH")}
          />
          <PaymentOption
            id="pm-upi"
            label="Pay via UPI"
            hint={
              upiAvailable
                ? `Opens your UPI app · pays ${store.name}`
                : "This store hasn't set up UPI yet."
            }
            checked={paymentMethod === "UPI"}
            onChange={() => setPaymentMethod("UPI")}
            disabled={!upiAvailable}
          />
        </fieldset>

        <button
          className="btn btn-primary w-full mt-5 !py-3"
          disabled={place.isPending || lines.length === 0 || belowMinimum}
          onClick={() => place.mutate()}
        >
          {place.isPending ? "Placing…" : primaryLabel}
        </button>
        <p className="text-[11px] text-neutral-400 text-center mt-2">
          Order for pickup at {slug}
        </p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium mb-1">{label}</span>
      {children}
    </label>
  );
}

function PaymentOption({
  id,
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex items-start gap-3 border rounded-xl p-3.5 cursor-pointer text-sm",
        checked ? "border-brand bg-brand-soft" : "border-neutral-200",
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      <input
        id={id}
        type="radio"
        name="payment-method"
        className="mt-1 accent-[#F97316]"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
      />
      <div>
        <div className="font-semibold">{label}</div>
        <div className="text-xs text-neutral-500 mt-0.5">{hint}</div>
      </div>
    </label>
  );
}
