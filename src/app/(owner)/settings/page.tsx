"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { PageHeader } from "@/components/owner/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useDemoStore } from "@/lib/hooks/use-demo-store";
import { useRepos } from "@/lib/repositories/repo-provider";
import type { Store } from "@/lib/domain/types";

interface FormState {
  name: string;
  tamilName: string;
  slug: string;
  description: string;
  phone: string;
  address: string;
  minOrderValue: string;
  prepTimeMinutes: string;
  status: "OPEN" | "CLOSED";
  showTamilNames: boolean;
}

function toForm(store: Store): FormState {
  return {
    name: store.name,
    tamilName: store.tamilName ?? "",
    slug: store.slug,
    description: store.description ?? "",
    phone: store.phone ?? "",
    address: store.address ?? "",
    minOrderValue: String(store.minOrderValue ?? 0),
    prepTimeMinutes: String(store.prepTimeMinutes ?? 15),
    status: store.status,
    showTamilNames: store.showTamilNames,
  };
}

export default function SettingsPage() {
  const { store, loading } = useDemoStore();
  const repos = useRepos();
  const [form, setForm] = React.useState<FormState | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (store) setForm(toForm(store));
  }, [store]);

  const dirty = React.useMemo(() => {
    if (!store || !form) return false;
    const orig = toForm(store);
    return JSON.stringify(orig) !== JSON.stringify(form);
  }, [store, form]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
    setSavedAt(null);
  }

  async function handleSave() {
    if (!repos || !store || !form) return;
    setError(null);
    setSaving(true);
    try {
      await repos.stores.update(store.id, {
        name: form.name.trim(),
        tamilName: form.tamilName.trim() || undefined,
        slug: form.slug.trim(),
        description: form.description.trim() || undefined,
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
        minOrderValue: Number(form.minOrderValue) || 0,
        prepTimeMinutes: Number(form.prepTimeMinutes) || undefined,
        status: form.status,
        showTamilNames: form.showTamilNames,
      });
      setSavedAt(Date.now());
      toast.success("Settings saved");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed.";
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  if (loading || !store || !form) {
    return (
      <div className="space-y-6">
        <PageHeader title="Settings" description="Loading…" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Cart profile, availability, and ordering preferences."
        actions={
          <>
            {savedAt && <Badge variant="success">Saved</Badge>}
            {dirty && <Badge variant="warning">Unsaved changes</Badge>}
            <Button onClick={handleSave} disabled={!dirty || saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save
            </Button>
          </>
        }
      />

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
            <CardDescription>Shown to customers on your menu page.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="s-name">Cart name *</Label>
              <Input
                id="s-name"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="s-tamil">Tamil name</Label>
              <Input
                id="s-tamil"
                value={form.tamilName}
                onChange={(e) => set("tamilName", e.target.value)}
                className="font-tamil"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="s-slug">URL slug *</Label>
              <div className="flex items-center gap-1 rounded-md border pl-3 focus-within:ring-2 focus-within:ring-ring">
                <span className="text-sm text-muted-foreground">/order/</span>
                <Input
                  id="s-slug"
                  value={form.slug}
                  onChange={(e) => set("slug", e.target.value.replace(/\s+/g, "-").toLowerCase())}
                  required
                  className="border-0 focus-visible:ring-0"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="s-desc">Description</Label>
              <Textarea
                id="s-desc"
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contact</CardTitle>
            <CardDescription>Optional — shown on receipts.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="s-phone">Phone</Label>
              <Input
                id="s-phone"
                inputMode="tel"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="s-address">Address</Label>
              <Textarea
                id="s-address"
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ordering</CardTitle>
            <CardDescription>Availability and thresholds.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label className="font-medium">Store is open</Label>
                <p className="text-xs text-muted-foreground">
                  Customers can place orders when this is on.
                </p>
              </div>
              <Switch
                checked={form.status === "OPEN"}
                onCheckedChange={(v) => set("status", v ? "OPEN" : "CLOSED")}
                aria-label="Store open toggle"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="s-min">Minimum order value (₹)</Label>
              <Input
                id="s-min"
                type="number"
                min={0}
                value={form.minOrderValue}
                onChange={(e) => set("minOrderValue", e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="s-prep">Prep time (minutes)</Label>
              <Input
                id="s-prep"
                type="number"
                min={0}
                value={form.prepTimeMinutes}
                onChange={(e) => set("prepTimeMinutes", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Display</CardTitle>
            <CardDescription>How customers see the menu.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label className="font-medium">Show Tamil names</Label>
                <p className="text-xs text-muted-foreground">
                  Displays தமிழ் text under English on menu &amp; cart.
                </p>
              </div>
              <Switch
                checked={form.showTamilNames}
                onCheckedChange={(v) => set("showTamilNames", v)}
                aria-label="Show Tamil names"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
