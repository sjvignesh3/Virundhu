"use client";

/**
 * Owner self-signup page.
 *
 * A brand-new owner arrives here from the login page, provides their identity
 * plus a minimal store bootstrap (name + kebab-case slug), and the backend
 * transactionally creates a User, Store, StoreUser (OWNER), StoreSettings,
 * and OrderSequence — with NO dummy categories/products/orders. On success
 * the JWT session is written to localStorage and the user is routed straight
 * to their empty dashboard.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ApiError, signupSchema, type SignupInput } from "@virundhu/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiCurrentSession, apiSignup } from "@/lib/api/auth-api";

/** Convert a store name into a safe kebab-case slug suggestion. */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

type FormState = {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  storeName: string;
  storeSlug: string;
  storeTamilName: string;
  storeDescription: string;
  storePhone: string;
  storeAddress: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
  storeName: "",
  storeSlug: "",
  storeTamilName: "",
  storeDescription: "",
  storePhone: "",
  storeAddress: "",
};

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = React.useState<Partial<Record<keyof FormState, string>>>({});
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (apiCurrentSession()) router.replace("/dashboard");
  }, [router]);

  // Auto-suggest the slug from the store name until the user edits it directly.
  React.useEffect(() => {
    if (!slugTouched) {
      setForm((prev) => ({ ...prev, storeSlug: slugify(prev.storeName) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.storeName]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    // Client-side confirmation match (server never sees confirmPassword).
    if (form.password !== form.confirmPassword) {
      setErrors({ confirmPassword: "Passwords do not match" });
      return;
    }

    const candidate: SignupInput = {
      name: form.name,
      email: form.email,
      phone: form.phone || undefined,
      password: form.password,
      storeName: form.storeName,
      storeSlug: form.storeSlug,
      storeTamilName: form.storeTamilName || undefined,
      storeDescription: form.storeDescription || undefined,
      storePhone: form.storePhone || undefined,
      storeAddress: form.storeAddress || undefined,
    };

    const parsed = signupSchema.safeParse(candidate);
    if (!parsed.success) {
      const fieldErrors: Partial<Record<keyof FormState, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FormState | undefined;
        if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      toast.error("Please fix the highlighted fields");
      return;
    }

    setBusy(true);
    try {
      await apiSignup(parsed.data);
      toast.success("Account created — welcome to Virundhu!");
      router.replace("/dashboard");
    } catch (err) {
      if (err instanceof ApiError) {
        const details = err.body.details as { field?: keyof FormState } | undefined;
        if (details?.field) {
          setErrors({ [details.field]: err.body.message });
        }
        toast.error(err.body.message);
      } else {
        toast.error((err as Error).message ?? "Signup failed");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardContent className="space-y-6 p-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Virundhu</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your owner account
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-5">
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Your details
              </h2>

              <div className="space-y-1.5">
                <Label htmlFor="name">Full name *</Label>
                <Input
                  id="name"
                  autoComplete="name"
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  required
                  disabled={busy}
                />
                {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  required
                  disabled={busy}
                />
                {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  disabled={busy}
                />
                {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    value={form.password}
                    onChange={(e) => update("password", e.target.value)}
                    required
                    minLength={8}
                    disabled={busy}
                  />
                  {errors.password && (
                    <p className="text-xs text-destructive">{errors.password}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword">Confirm password *</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    value={form.confirmPassword}
                    onChange={(e) => update("confirmPassword", e.target.value)}
                    required
                    minLength={8}
                    disabled={busy}
                  />
                  {errors.confirmPassword && (
                    <p className="text-xs text-destructive">{errors.confirmPassword}</p>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                At least 8 characters, with a letter and a number.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Your shop
              </h2>

              <div className="space-y-1.5">
                <Label htmlFor="storeName">Shop name *</Label>
                <Input
                  id="storeName"
                  value={form.storeName}
                  onChange={(e) => update("storeName", e.target.value)}
                  required
                  disabled={busy}
                />
                {errors.storeName && (
                  <p className="text-xs text-destructive">{errors.storeName}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="storeSlug">Shop URL *</Label>
                <div className="flex items-center gap-1 text-sm">
                  <span className="text-muted-foreground">/order/</span>
                  <Input
                    id="storeSlug"
                    value={form.storeSlug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      update("storeSlug", slugify(e.target.value));
                    }}
                    required
                    minLength={3}
                    disabled={busy}
                    placeholder="my-shop"
                  />
                </div>
                {errors.storeSlug ? (
                  <p className="text-xs text-destructive">{errors.storeSlug}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Lowercase letters, numbers, and hyphens only.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="storeTamilName">Tamil name (optional)</Label>
                <Input
                  id="storeTamilName"
                  value={form.storeTamilName}
                  onChange={(e) => update("storeTamilName", e.target.value)}
                  disabled={busy}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="storeAddress">Address (optional)</Label>
                <Input
                  id="storeAddress"
                  value={form.storeAddress}
                  onChange={(e) => update("storeAddress", e.target.value)}
                  disabled={busy}
                />
              </div>
            </section>

            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Creating your account…" : "Create account"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
