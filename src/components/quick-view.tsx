"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useScrollLock } from "@/lib/use-scroll-lock";
import { fetchQuickView } from "@/app/products/actions";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { Price } from "@/components/price";
import { ProductGallery } from "@/components/product-gallery";
import type { Product } from "@/lib/types";

/**
 * "Quick view" affordance on a product card.
 *
 * A sibling of the card's <Link>, never a child of it: a button inside an
 * anchor is invalid markup, and the click would navigate before it opened
 * anything. The card is the `group`, so this reveals on hover over any part
 * of it.
 *
 * Always visible below `sm`. Hover does not exist on a touch screen, and a
 * control nobody can reach is worse than one that is simply there.
 */
export function QuickViewButton({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="absolute inset-x-0 bottom-0 z-20 bg-black/80 py-2.5 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-white opacity-100 transition-opacity hover:bg-black sm:opacity-0 sm:group-hover:opacity-100"
      >
        Quick view
      </button>

      {open && <QuickViewDialog slug={slug} onClose={() => setOpen(false)} />}
    </>
  );
}

function QuickViewDialog({
  slug,
  onClose,
}: {
  slug: string;
  onClose: () => void;
}) {
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The listing carries only the cover image, so the gallery is fetched here.
  useEffect(() => {
    let cancelled = false;
    fetchQuickView(slug)
      .then((result) => {
        if (cancelled) return;
        if (!result) setError("That product is no longer available.");
        else setProduct(result);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load this product.");
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useScrollLock();

  // Escape to dismiss.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={product ? product.name : "Quick view"}
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-t-2xl border border-black/10 bg-background p-5 text-left shadow-xl dark:border-white/15 sm:rounded-2xl sm:p-6"
      >
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close quick view"
            className="-mr-1 -mt-1 flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {error ? (
          <p role="alert" className="py-10 text-center text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : !product ? (
          /* Matches the loaded layout's proportions, so opening does not jump. */
          <div className="grid gap-6 py-4 sm:grid-cols-2">
            <div className="aspect-square w-full animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />
            <div className="flex flex-col gap-3">
              <div className="h-6 w-2/3 animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />
              <div className="h-5 w-1/3 animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />
              <div className="h-24 w-full animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />
            </div>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2">
            <ProductGallery images={product.images} name={product.name} />

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <h2 className="text-xl font-semibold tracking-tight">
                  {product.name}
                </h2>
                <Price
                  price={product.price}
                  offerPrice={product.offerPrice}
                  discountPercent={product.discountPercent}
                  size="lg"
                />
              </div>

              <p className="line-clamp-3 text-sm text-zinc-500 dark:text-zinc-400">
                {product.description}
              </p>

              {/* The same control the product page uses, so sizes, stock, the
                  sign-in prompt and "Buy now" behave identically here. */}
              <AddToCartButton product={product} />

              <Link
                href={`/products/${product.slug}`}
                onClick={onClose}
                className="flex h-12 items-center justify-center rounded-full border border-black/15 font-medium transition-colors hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
              >
                Product details
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
