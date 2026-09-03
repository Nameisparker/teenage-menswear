"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setProductDiscount } from "@/app/admin/actions";
import { formatPrice } from "@/lib/format";
import { MAX_DISCOUNT_PERCENT, offerPriceFor } from "@/lib/pricing";
import { ProductImage } from "@/components/product-image";
import type { AdminProduct } from "@/lib/admin-catalog";

/**
 * One product's discount, with the offer price recalculated as you type.
 *
 * The preview comes from offerPriceFor(), which mirrors the database's
 * generated column — so the number shown before saving is the number the
 * customer will be charged after.
 */
export function DiscountRow({ product }: { product: AdminProduct }) {
  const router = useRouter();
  const [value, setValue] = useState(String(product.discountPercent));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const parsed = Number(value);
  const valid =
    value.trim() !== "" &&
    Number.isInteger(parsed) &&
    parsed >= 0 &&
    parsed <= MAX_DISCOUNT_PERCENT;

  const preview = valid ? offerPriceFor(product.price, parsed) : null;
  const saved = product.discountPercent;
  const dirty = valid && parsed !== saved;

  function save(percent: number) {
    startTransition(async () => {
      const result = await setProductDiscount(product.id, percent);
      if (!result.ok) {
        setError(result.error ?? "Could not save.");
        return;
      }
      setError(null);
      router.refresh();
    });
  }

  return (
    <tr className="border-b border-black/5 dark:border-white/5">
      <td className="sticky left-0 z-10 bg-background py-3 pr-3">
        <div className="flex items-center gap-3">
          <ProductImage
            image={product.imagePath}
            name={product.name}
            className="h-10 w-10 flex-shrink-0 rounded"
            sizes="40px"
          />
          <div className="flex flex-col">
            <span className="font-medium">{product.name}</span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {product.categorySlug}
              {!product.isActive && " · hidden"}
            </span>
          </div>
        </div>
      </td>

      <td className="py-3 pr-3 whitespace-nowrap text-zinc-600 dark:text-zinc-400">
        {formatPrice(product.price)}
      </td>

      <td className="py-3 pr-3">
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={0}
            max={MAX_DISCOUNT_PERCENT}
            step={1}
            value={value}
            disabled={pending}
            onChange={(event) => setValue(event.target.value)}
            aria-label={`Discount percent for ${product.name}`}
            className="w-20 rounded-md border border-black/15 bg-transparent px-2 py-1.5 text-sm disabled:opacity-60 dark:border-white/20"
          />
          <span className="text-sm text-zinc-500 dark:text-zinc-400">%</span>
        </div>
      </td>

      <td className="py-3 pr-3 whitespace-nowrap">
        {preview === null ? (
          <span className="text-sm text-zinc-400">—</span>
        ) : parsed === 0 ? (
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            {formatPrice(product.price)}
          </span>
        ) : (
          <div className="flex flex-col">
            <span className="font-semibold text-accent">
              {formatPrice(preview)}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              saves {formatPrice(product.price - preview)}
            </span>
          </div>
        )}
      </td>

      <td className="py-3 text-right">
        <div className="flex items-center justify-end gap-3">
          {error && (
            <span role="alert" className="text-xs text-red-600 dark:text-red-400">
              {error}
            </span>
          )}
          {saved > 0 && !dirty && !pending && (
            <button
              type="button"
              onClick={() => {
                setValue("0");
                save(0);
              }}
              className="text-xs text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            disabled={!dirty || pending}
            onClick={() => save(parsed)}
            className="h-8 rounded-full bg-accent px-3 text-xs font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </td>
    </tr>
  );
}
