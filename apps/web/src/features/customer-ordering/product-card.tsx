"use client";

import * as React from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import type { Product } from "@/lib/domain/types";

interface ProductCardProps {
  product: Product;
  quantity: number;
  showTamil: boolean;
  onAdd: () => void;
  onRemove: () => void;
}

export function ProductCard({
  product,
  quantity,
  showTamil,
  onAdd,
  onRemove,
}: ProductCardProps) {
  const unavailable = !product.available;

  return (
    <div
      className={`flex gap-3 rounded-lg border bg-card p-3 shadow-sm transition-opacity sm:p-4 ${
        unavailable ? "opacity-60" : ""
      }`}
    >
      {/* Placeholder tile — gradient by product id hash for visual variety. */}
      <div
        className="hidden h-20 w-20 shrink-0 rounded-md bg-gradient-to-br from-orange-200 to-amber-100 dark:from-orange-500/30 dark:to-amber-700/30 sm:block"
        aria-hidden
      />
      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-semibold leading-snug">{product.name}</h3>
            {showTamil && product.tamilName && (
              <p className="truncate text-sm text-muted-foreground font-tamil">
                {product.tamilName}
              </p>
            )}
          </div>
          {unavailable && (
            <Badge variant="secondary" className="shrink-0">
              Unavailable
            </Badge>
          )}
        </div>

        {product.description && (
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {product.description}
          </p>
        )}

        <div className="mt-1 flex items-end justify-between gap-2">
          <div>
            <p className="font-bold">{formatCurrency(product.price)}</p>
            <p className="text-xs text-muted-foreground">per {product.unit}</p>
          </div>
          {unavailable ? null : quantity === 0 ? (
            <Button size="sm" onClick={onAdd}>
              <Plus className="h-4 w-4" />
              Add
            </Button>
          ) : (
            <div className="flex items-center gap-1 rounded-md border bg-background p-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onRemove}
                aria-label={`Remove one ${product.name}`}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span
                className="min-w-[1.5rem] text-center text-sm font-semibold tabular-nums"
                aria-live="polite"
              >
                {quantity}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onAdd}
                aria-label={`Add one more ${product.name}`}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
