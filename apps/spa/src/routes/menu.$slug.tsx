import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { publicMenuKeys, publicMenuRepo, ordersRepo } from "@virundhu/client";
import type { PublicMenuProduct, PublicMenuStore } from "@virundhu/client";
import type { ActivePaymentMethod } from "@virundhu/shared";
import { cartStore, useCart, cartSubtotal, cartCount } from "@/lib/cart";
import { formatCurrency } from "@/lib/format";
import { transformImageUrl } from "@/lib/image";
import { buildUpiIntentUrl } from "@/lib/upi";
import { cn } from "@/lib/cn";

export const Route = createFileRoute("/menu/$slug")({
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
  const count = useCart((s) => cartCount(s.lines));

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
  const heroSrc = transformImageUrl(store.imageUrl, { width: 800, quality: 80 });

  return (
    <div className="min-h-full bg-neutral-50 pb-24">
      <header className="bg-white border-b border-neutral-200">
        {heroSrc ? (
          <img
            src={heroSrc}
            alt=""
            className="w-full h-32 md:h-40 object-cover"
            // Above-the-fold — eager decode + high fetch priority for LCP.
            loading="eager"
            decoding="async"
            fetchPriority="high"
          />
        ) : null}
        <div className="max-w-2xl mx-auto p-4">
          <h1 className="text-xl font-semibold">{store.name}</h1>
          {showTamil && store.tamilName ? (
            <div className="text-sm text-neutral-600">{store.tamilName}</div>
          ) : null}
          {!acceptOrders ? (
            <div className="mt-2 text-xs badge bg-amber-100 text-amber-800">
              Not accepting orders right now
            </div>
          ) : null}
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-3 space-y-6">
        {categories.map((cat) => (
          <section key={cat.id}>
            <h2 className="font-semibold mb-2">
              {cat.name}
              {showTamil && cat.tamilName ? (
                <span className="text-sm text-neutral-500 ml-2">{cat.tamilName}</span>
              ) : null}
            </h2>
            <div className="grid gap-2">
              {cat.products.map((p) => (
                <ProductRow key={p.id} product={p} showTamil={showTamil} disabled={!acceptOrders} />
              ))}
            </div>
          </section>
        ))}
      </main>

      {count > 0 && acceptOrders ? (
        <div className="fixed inset-x-0 bottom-0 bg-white border-t p-3">
          <div className="max-w-2xl mx-auto">
            <button
              className="btn btn-primary w-full"
              onClick={() => setCheckoutOpen(true)}
            >
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

function MenuSkeleton() {
  // Lightweight above-the-fold skeleton — shipped in the initial HTML shell
  // and rendered during the network fetch. Prevents CLS + hits LCP target.
  return (
    <div className="min-h-full bg-neutral-50 pb-24">
      <div className="bg-white border-b border-neutral-200">
        <div className="w-full h-32 md:h-40 bg-neutral-200 animate-pulse" />
        <div className="max-w-2xl mx-auto p-4 space-y-2">
          <div className="h-6 w-40 bg-neutral-200 rounded animate-pulse" />
          <div className="h-4 w-24 bg-neutral-200 rounded animate-pulse" />
        </div>
      </div>
      <main className="max-w-2xl mx-auto p-3 space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card p-3 h-20 bg-neutral-100 animate-pulse" />
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
  const thumb = transformImageUrl(product.imageUrl, { width: 200 });

  return (
    <div className={cn("card p-3 flex items-center gap-3", !product.isAvailable && "opacity-50")}>
      {thumb ? (
        <img
          src={thumb}
          alt=""
          width={64}
          height={64}
          className="w-16 h-16 rounded object-cover flex-shrink-0"
          loading="lazy"
          decoding="async"
        />
      ) : null}
      <div className="flex-1 min-w-0">
        <div className="font-medium">{product.name}</div>
        {showTamil && product.tamilName ? (
          <div className="text-sm text-neutral-500">{product.tamilName}</div>
        ) : null}
        <div className="text-sm font-semibold tabular-nums mt-1">
          {formatCurrency(product.price)}
          {product.unit ? <span className="text-neutral-400"> / {product.unit}</span> : null}
        </div>
      </div>
      {product.isAvailable && !disabled ? (
        qty === 0 ? (
          <button
            className="btn btn-primary text-sm"
            onClick={() =>
              add(
                {
                  productId: product.id,
                  name: product.name,
                  tamilName: product.tamilName,
                  unitPrice: product.price,
                },
                1,
              )
            }
          >
            Add
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              className="btn btn-outline text-sm w-8 h-8 p-0"
              onClick={() => add({ productId: product.id, name: product.name, tamilName: product.tamilName, unitPrice: product.price }, -1)}
            >
              −
            </button>
            <span className="w-6 text-center font-medium tabular-nums">{qty}</span>
            <button
              className="btn btn-outline text-sm w-8 h-8 p-0"
              onClick={() => add({ productId: product.id, name: product.name, tamilName: product.tamilName, unitPrice: product.price }, 1)}
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
  // Payment selection — Stage 7. Defaults to UPI when the vendor has a VPA
  // on file (higher conversion + no cash-handling friction), else CASH.
  const upiAvailable = Boolean(store.upiId);
  const [paymentMethod, setPaymentMethod] = useState<ActivePaymentMethod>(
    upiAvailable ? "UPI" : "CASH",
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

      // If the customer picked UPI, open the intent URL in a new context
      // BEFORE navigating so the click is still trusted (Safari/iOS ignore
      // programmatic `location.href` writes after a routing transition).
      if (paymentMethod === "UPI" && store.upiId) {
        const upiUrl = buildUpiIntentUrl({
          vpa: store.upiId,
          payeeName: store.name,
          amount: order.total_amount,
          orderNumber: order.order_number,
        });
        if (upiUrl) {
          // `location.assign` triggers the OS handoff on Android/iOS;
          // desktop browsers show their "open in app" chooser or ignore.
          window.location.assign(upiUrl);
        } else {
          toast.error("Could not launch UPI app. Please pay by cash on pickup.");
        }
      }

      onClose();
      navigate({
        to: "/menu/$slug/success/$orderNumber",
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
    <div className="fixed inset-0 bg-black/50 grid place-items-end md:place-items-center z-50">
      <div className="bg-white w-full md:max-w-md md:rounded-lg max-h-[90vh] overflow-auto p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Your order</h2>
          <button className="text-neutral-400" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="divide-y">
          {lines.map((l) => (
            <div key={l.productId} className="py-2 flex items-center justify-between text-sm">
              <div>
                <div className="font-medium">{l.name}</div>
                <div className="text-xs text-neutral-500">× {l.quantity}</div>
              </div>
              <div className="font-semibold tabular-nums">
                {formatCurrency(l.unitPrice * l.quantity)}
              </div>
            </div>
          ))}
        </div>
        <div className="py-3 flex items-center justify-between font-semibold">
          <span>Subtotal</span>
          <span className="tabular-nums">{formatCurrency(subtotal)}</span>
        </div>
        <div className="space-y-2">
          <input
            className="input"
            placeholder="Your name (optional)"
            value={customer.name}
            onChange={(e) => setCustomer((c) => ({ ...c, name: e.target.value }))}
          />
          <input
            className="input"
            placeholder="Phone (optional)"
            value={customer.phone}
            onChange={(e) => setCustomer((c) => ({ ...c, phone: e.target.value }))}
          />
          <textarea
            className="input min-h-[60px]"
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* Payment method — Stage 7 */}
        <fieldset className="mt-3 space-y-2">
          <legend className="text-xs uppercase tracking-wide text-neutral-500">
            Payment
          </legend>
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
          className="btn btn-primary w-full mt-4"
          disabled={place.isPending || lines.length === 0}
          onClick={() => place.mutate()}
        >
          {place.isPending ? "Placing…" : primaryLabel}
        </button>
        <p className="text-[10px] text-neutral-400 text-center mt-2">
          Order for pickup at {slug}
        </p>
      </div>
    </div>
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
        "flex items-start gap-3 border rounded-md p-3 cursor-pointer text-sm",
        checked ? "border-brand bg-brand/5" : "border-neutral-200",
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      <input
        id={id}
        type="radio"
        name="payment-method"
        className="mt-1"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
      />
      <div>
        <div className="font-medium">{label}</div>
        <div className="text-xs text-neutral-500">{hint}</div>
      </div>
    </label>
  );
}
