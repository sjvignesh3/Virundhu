"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Category, Product, Unit } from "@/lib/domain/types";
import { useRepos } from "@/lib/repositories/repo-provider";

const UNITS: Unit[] = ["plate", "piece", "cup", "glass", "bottle", "kg", "g"];

interface ProductFormProps {
  storeId: string;
  categories: Category[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
}

export function ProductForm({
  storeId,
  categories,
  open,
  onOpenChange,
  product,
}: ProductFormProps) {
  const repos = useRepos();
  const isEdit = !!product;

  const [name, setName] = React.useState("");
  const [tamilName, setTamilName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [priceStr, setPriceStr] = React.useState("");
  const [unit, setUnit] = React.useState<Unit>("plate");
  const [categoryId, setCategoryId] = React.useState<string>("");
  const [available, setAvailable] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setName(product?.name ?? "");
    setTamilName(product?.tamilName ?? "");
    setDescription(product?.description ?? "");
    setPriceStr(product ? String(product.price) : "");
    setUnit(product?.unit ?? "plate");
    setCategoryId(product?.categoryId ?? categories[0]?.id ?? "");
    setAvailable(product?.available ?? true);
    setError(null);
    setBusy(false);
  }, [open, product, categories]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!repos) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Name is required.");
      return;
    }
    if (!categoryId) {
      setError("Pick a category.");
      return;
    }
    const price = Number(priceStr);
    if (!Number.isFinite(price) || price < 0 || !/^\d+$/.test(priceStr.trim())) {
      setError("Price must be a whole number ≥ 0.");
      return;
    }

    setBusy(true);
    try {
      if (isEdit && product) {
        await repos.products.update(product.id, {
          name: trimmedName,
          tamilName: tamilName.trim() || undefined,
          description: description.trim() || undefined,
          price,
          unit,
          categoryId,
          available,
        });
      } else {
        await repos.products.create({
          storeId,
          categoryId,
          name: trimmedName,
          tamilName: tamilName.trim() || undefined,
          description: description.trim() || undefined,
          price,
          unit,
          available,
        });
      }
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit product" : "New product"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update the menu item." : "Add a new menu item to your store."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="p-name">Name</Label>
            <Input
              id="p-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Chicken Kothu Parotta"
              autoFocus
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="p-tamil">Tamil name (optional)</Label>
            <Input
              id="p-tamil"
              value={tamilName}
              onChange={(e) => setTamilName(e.target.value)}
              placeholder="சிக்கன் கொத்து பரோட்டா"
              className="font-tamil"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="p-price">Price (₹)</Label>
              <Input
                id="p-price"
                inputMode="numeric"
                pattern="[0-9]*"
                value={priceStr}
                onChange={(e) => setPriceStr(e.target.value.replace(/[^\d]/g, ""))}
                placeholder="120"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="p-unit">Unit</Label>
              <Select value={unit} onValueChange={(v) => setUnit(v as Unit)}>
                <SelectTrigger id="p-unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="p-category">Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger id="p-category">
                <SelectValue placeholder="Pick a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {categories.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No categories yet. Create one first.
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="p-desc">Description (optional)</Label>
            <Textarea
              id="p-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description shown on the menu card."
              rows={3}
            />
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Available</p>
              <p className="text-xs text-muted-foreground">
                Customers can order this item.
              </p>
            </div>
            <Switch
              checked={available}
              onCheckedChange={setAvailable}
              aria-label="Available for ordering"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy || categories.length === 0}>
              {busy ? "Saving…" : isEdit ? "Save changes" : "Create product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
