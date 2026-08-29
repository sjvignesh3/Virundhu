import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { storeKeys, storesRepo } from "@virundhu/client";
import { upiVpaSchema } from "@virundhu/shared";
import type { StoreRow } from "@virundhu/shared";
import { useActiveStoreId } from "@/lib/useActiveStoreId";
import { PageHeader } from "@/components/PageHeader";
import { NoStoreState } from "@/components/NoStoreState";
import { cn } from "@/lib/cn";

export const Route = createFileRoute("/_auth/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const storeId = useActiveStoreId();
  if (!storeId) return <NoStoreState />;
  return <SettingsInner storeId={storeId} />;
}

interface FormState {
  name: string;
  tamil_name: string;
  phone: string;
  address: string;
  upi_id: string;
  tax_rate: string;
  minimum_order_value: string;
  accept_orders: boolean;
  show_tamil_names: boolean;
}

function toForm(s: StoreRow): FormState {
  return {
    name: s.name ?? "",
    tamil_name: s.tamil_name ?? "",
    phone: s.phone ?? "",
    address: s.address ?? "",
    upi_id: s.upi_id ?? "",
    tax_rate: String(s.tax_rate ?? 0),
    minimum_order_value: String(s.minimum_order_value ?? 0),
    accept_orders: Boolean(s.accept_orders),
    show_tamil_names: Boolean(s.show_tamil_names),
  };
}

function SettingsInner({ storeId }: { storeId: string }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: storeKeys.detail(storeId),
    queryFn: () => storesRepo.get(storeId),
  });

  const [form, setForm] = useState<FormState | null>(null);
  useEffect(() => {
    if (q.data && form === null) setForm(toForm(q.data));
  }, [q.data, form]);

  const save = useMutation({
    mutationFn: (f: FormState) =>
      storesRepo.update(storeId, {
        name: f.name.trim(),
        tamil_name: f.tamil_name.trim() || null,
        phone: f.phone.trim() || null,
        address: f.address.trim() || null,
        upi_id: f.upi_id.trim() || null,
        tax_rate: Number.parseFloat(f.tax_rate) || 0,
        minimum_order_value: Number.parseFloat(f.minimum_order_value) || 0,
        accept_orders: f.accept_orders,
        show_tamil_names: f.show_tamil_names,
      }),
    onSuccess: (row) => {
      toast.success("Settings saved");
      qc.setQueryData(storeKeys.detail(storeId), row);
      qc.invalidateQueries({ queryKey: storeKeys.detail(storeId) });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Save failed"),
  });

  if (q.isLoading || !form) {
    return <div className="p-6 text-sm text-neutral-500">Loading…</div>;
  }
  if (q.error) {
    return (
      <div className="p-6">
        <div className="card p-4 border-red-200 bg-red-50 text-red-700 text-sm">
          {(q.error as Error).message}
        </div>
      </div>
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    const vpa = form.upi_id.trim();
    if (vpa && !upiVpaSchema.safeParse(vpa).success) {
      toast.error("UPI ID looks invalid — expected something like shopname@okhdfcbank");
      return;
    }
    const tax = Number.parseFloat(form.tax_rate);
    if (!Number.isFinite(tax) || tax < 0 || tax > 50) {
      toast.error("Tax rate must be between 0 and 50%");
      return;
    }
    save.mutate(form);
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-2xl">
      <PageHeader title="Settings" subtitle="Store profile, ordering and payments." />

      <form onSubmit={submit} className="space-y-4">
        <section className="card p-5 space-y-3">
          <h2 className="font-bold">Profile</h2>
          <Field id="st-name" label="Store name">
            <input
              id="st-name"
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </Field>
          <Field id="st-tamil" label="Tamil name (optional)">
            <input
              id="st-tamil"
              className="input"
              value={form.tamil_name}
              onChange={(e) => setForm({ ...form, tamil_name: e.target.value })}
            />
          </Field>
          <div className="grid md:grid-cols-2 gap-3">
            <Field id="st-phone" label="Phone">
              <input
                id="st-phone"
                className="input"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </Field>
            <Field id="st-slug" label="Slug (fixed)">
              <input id="st-slug" className="input opacity-60" value={q.data?.slug ?? ""} readOnly />
            </Field>
          </div>
          <Field id="st-address" label="Address">
            <input
              id="st-address"
              className="input"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </Field>
        </section>

        <section className="card p-5 space-y-3">
          <h2 className="font-bold">Ordering</h2>
          <Toggle
            label="Accept orders"
            hint="Turn off to pause the public menu (customers can browse but not order)."
            checked={form.accept_orders}
            onChange={(v) => setForm({ ...form, accept_orders: v })}
          />
          <Toggle
            label="Show Tamil names"
            hint="Display Tamil translations on the customer menu."
            checked={form.show_tamil_names}
            onChange={(v) => setForm({ ...form, show_tamil_names: v })}
          />
          <div className="grid md:grid-cols-2 gap-3">
            <Field id="st-tax" label={`Tax rate (%) · currency ${q.data?.currency ?? "INR"}`}>
              <input
                id="st-tax"
                type="number"
                step="0.01"
                min="0"
                max="50"
                className="input"
                value={form.tax_rate}
                onChange={(e) => setForm({ ...form, tax_rate: e.target.value })}
              />
            </Field>
            <Field id="st-min" label="Minimum order value (₹)">
              <input
                id="st-min"
                type="number"
                step="1"
                min="0"
                className="input"
                value={form.minimum_order_value}
                onChange={(e) => setForm({ ...form, minimum_order_value: e.target.value })}
              />
            </Field>
          </div>
        </section>

        <section className="card p-5 space-y-3">
          <h2 className="font-bold">Payments</h2>
          <Field id="st-upi" label="UPI ID (VPA)">
            <input
              id="st-upi"
              className="input font-mono"
              placeholder="shopname@okhdfcbank"
              value={form.upi_id}
              onChange={(e) => setForm({ ...form, upi_id: e.target.value })}
            />
          </Field>
          <p className="text-xs text-neutral-500">
            {form.upi_id.trim()
              ? "Customers get a “Pay via UPI” button that opens their UPI app with the amount prefilled."
              : "No UPI ID — customers pay cash at pickup. Add your VPA to enable UPI."}
          </p>
        </section>

        <div className="flex justify-end">
          <button type="submit" className="btn btn-primary" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-neutral-500 mt-0.5">{hint}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          "w-11 h-7 rounded-full p-0.5 transition-colors shrink-0",
          checked ? "bg-brand" : "bg-neutral-300",
        )}
      >
        <span
          className={cn(
            "block w-6 h-6 rounded-full bg-white shadow transition-transform",
            checked && "translate-x-4",
          )}
        />
      </button>
    </div>
  );
}
