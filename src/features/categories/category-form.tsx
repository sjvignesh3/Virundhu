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
import type { Category } from "@/lib/domain/types";
import { useRepos } from "@/lib/repositories/repo-provider";

interface CategoryFormProps {
  storeId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, dialog is in edit mode. */
  category?: Category | null;
  /** Next sortOrder to assign for new categories. */
  nextSortOrder: number;
}

export function CategoryForm({
  storeId,
  open,
  onOpenChange,
  category,
  nextSortOrder,
}: CategoryFormProps) {
  const repos = useRepos();
  const isEdit = !!category;

  const [name, setName] = React.useState("");
  const [tamilName, setTamilName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setName(category?.name ?? "");
      setTamilName(category?.tamilName ?? "");
      setError(null);
      setBusy(false);
    }
  }, [open, category]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!repos) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is required.");
      return;
    }
    setBusy(true);
    try {
      if (isEdit && category) {
        await repos.categories.update(category.id, {
          name: trimmed,
          tamilName: tamilName.trim() || undefined,
        });
      } else {
        await repos.categories.create({
          storeId,
          name: trimmed,
          tamilName: tamilName.trim() || undefined,
          sortOrder: nextSortOrder,
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit category" : "New category"}</DialogTitle>
          <DialogDescription>
            Categories group products on the customer menu.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="cat-name">Name</Label>
            <Input
              id="cat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Chicken"
              autoFocus
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="cat-tamil">Tamil name (optional)</Label>
            <Input
              id="cat-tamil"
              value={tamilName}
              onChange={(e) => setTamilName(e.target.value)}
              placeholder="சிக்கன்"
              className="font-tamil"
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
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : isEdit ? "Save changes" : "Create category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
