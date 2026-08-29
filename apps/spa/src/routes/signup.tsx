import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { signup } from "@virundhu/client";
import { captureError } from "@/lib/sentry";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
    storeName: "",
    storeSlug: "",
    // Stage 7 — Vendor UPI VPA. Optional at signup; owner can add/edit
    // later in Settings. When empty, customer checkout is CASH-only.
    storeUpiId: "",
  });
  const [busy, setBusy] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await signup(form);
      if (res.session) {
        toast.success("Account created");
        await navigate({ to: "/dashboard" });
      } else {
        toast.success("Account created — check your email to verify, then sign in.");
        await navigate({ to: "/login" });
      }
    } catch (err) {
      captureError(err, { flow: "signup" });
      toast.error(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-full grid place-items-center p-4">
      <div className="card w-full max-w-md p-6">
        <h1 className="text-xl font-semibold mb-1">Create your store</h1>
        <p className="text-sm text-neutral-500 mb-4">Start selling in minutes</p>
        <form onSubmit={onSubmit} className="space-y-3">
          <Field label="Your name" value={form.name} onChange={(v) => update("name", v)} required />
          <Field label="Email" type="email" value={form.email} onChange={(v) => update("email", v)} required />
          <Field label="Password" type="password" value={form.password} onChange={(v) => update("password", v)} required minLength={8} />
          <Field label="Store name" value={form.storeName} onChange={(v) => update("storeName", v)} required />
          <Field
            label="Store slug"
            value={form.storeSlug}
            onChange={(v) => update("storeSlug", v.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
            required
            hint="Used in your storefront URL. Lowercase, hyphens only."
          />
          <Field
            label="UPI ID (optional)"
            value={form.storeUpiId}
            onChange={(v) => update("storeUpiId", v.trim().toLowerCase())}
            hint="e.g. yourname@okhdfcbank. Customers who pick 'Pay via UPI' will pay this address. Leave blank to accept cash only."
            placeholder="yourname@okhdfcbank"
          />
          <button type="submit" className="btn btn-primary w-full" disabled={busy}>
            {busy ? "Creating…" : "Create account"}
          </button>
        </form>
        <p className="text-sm text-neutral-500 mt-4">
          Already have an account?{" "}
          <Link to="/login" className="text-brand hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  minLength?: number;
  hint?: string;
  placeholder?: string;
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  minLength,
  hint,
  placeholder,
}: FieldProps) {
  return (
    <div>
      <label className="block text-sm mb-1">{label}</label>
      <input
        type={type}
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        minLength={minLength}
        placeholder={placeholder}
      />
      {hint ? <p className="text-xs text-neutral-500 mt-1">{hint}</p> : null}
    </div>
  );
}
