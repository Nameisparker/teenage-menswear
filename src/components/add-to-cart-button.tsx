"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useCart } from "@/context/cart-context";
import { useAuth } from "@/context/auth-context";
import { savePendingCartAdd } from "@/lib/pending-cart";
import { SizeChart } from "./size-chart";
import { LOW_STOCK } from "@/lib/inventory";
import type { Product } from "@/lib/types";

export function AddToCartButton({ product }: { product: Product }) {
  const { addItem, items } = useCart();
  const { user, loading, openAuth } = useAuth();
  const router = useRouter();

  const stockFor = (size: string) => product.stockBySize[size] ?? 0;

  // Opens on a size someone can actually buy. Defaulting to sizes[0] when it
  // is sold out puts the page in a dead state the shopper has to work out.
  // A product with no variants left would otherwise send size=undefined to a
  // NOT NULL column. Empty string keeps the guard in addItem meaningful.
  const [size, setSize] = useState(
    product.sizes.find((s) => stockFor(s) > 0) ?? product.sizes[0] ?? ""
  );
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Read from the cart itself rather than a local "was clicked" flag, so
  // "Buy now" is still there after a reload, and disappears again when the
  // shopper switches to a size they have not added.
  const inCartQuantity =
    items.find((item) => item.productId === product.id && item.size === size)
      ?.quantity ?? 0;
  const inCart = inCartQuantity > 0;

  const available = stockFor(size);
  const soldOut = product.sizes.every((s) => stockFor(s) === 0);
  // Everything left of this size is already in their cart. place_order would
  // refuse the extra one anyway; saying so here beats failing at checkout.
  const maxedOut = available > 0 && inCartQuantity >= available;

  // One timer, cleared on unmount and restarted by each success — without
  // this, rapid clicks stack timeouts that race to clear the confirmation.
  useEffect(() => {
    if (!added) return;
    const timer = setTimeout(() => setAdded(false), 1500);
    return () => clearTimeout(timer);
  }, [added]);

  async function handleAdd() {
    // Not signed in: park the intent and let the modal take over. PendingCartAdd
    // finishes the add once sign-in succeeds, including after a Google redirect.
    if (!user) {
      savePendingCartAdd(product, size);
      openAuth();
      return;
    }

    setBusy(true);
    setError(null);
    // Wait for the write. Confirming before it lands means a failed add still
    // reads “Added to cart”, and the customer only finds out at the cart.
    const result = await addItem(product, size);
    setBusy(false);

    if (!result.ok) {
      setError(result.error ?? "Could not add to cart.");
      return;
    }
    setAdded(true);
  }

  return (
    <div className="flex flex-col gap-4">
      {product.sizes.length > 1 && (
        <div className="flex flex-col gap-3">
          <span className="text-sm font-medium">Size</span>
          <div className="flex flex-wrap gap-2">
            {product.sizes.map((s) => {
              const gone = stockFor(s) === 0;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSize(s)}
                  disabled={gone}
                  aria-label={gone ? `${s} — out of stock` : s}
                  className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                    size === s
                      ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                      : gone
                        ? "cursor-not-allowed border-black/10 text-zinc-400 line-through dark:border-white/10 dark:text-zinc-600"
                        : "border-black/15 hover:border-black/40 dark:border-white/20 dark:hover:border-white/50"
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
          {/* Below the chips rather than beside the label: the expanded table
              needs the full column width. */}
          <SizeChart sizes={product.sizes} />
        </div>
      )}

      {/* Outside the size block on purpose — a one-size product has no chips
          but can still be down to its last two. */}
      {available > 0 && available <= LOW_STOCK && (
        <p className="text-sm font-medium text-amber-700 dark:text-amber-500">
          Only {available} left{product.sizes.length > 1 && ` in ${size}`}.
        </p>
      )}

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => void handleAdd()}
          disabled={
            loading ||
            busy ||
            product.sizes.length === 0 ||
            available === 0 ||
            maxedOut
          }
          // Green for as long as the size is in the cart, so the state is
          // still readable after a scroll or a reload — not just for the
          // second or two after the click.
          className={`flex h-12 w-full items-center justify-center rounded-full px-5 font-medium transition-colors disabled:opacity-60 ${
            inCart
              ? "bg-emerald-600 text-white hover:bg-emerald-700"
              : "bg-accent text-accent-foreground hover:opacity-90"
          }`}
        >
          {soldOut
            ? "Sold out"
            : available === 0
              ? `Out of stock in ${size}`
              : maxedOut
                ? `All ${available} in your cart`
                : busy
                  ? "Adding…"
                  : added
                    ? "✓ Added to cart"
                    : inCart
                      ? "✓ In cart"
                      : "Add to cart"}
        </button>

        {/* Appears only once this size is actually in the cart, so it can
            never send someone to an empty checkout. */}
        {inCart && (
          <button
            type="button"
            onClick={() => router.push("/checkout")}
            className="flex h-12 w-full items-center justify-center rounded-full border border-black bg-transparent px-5 font-medium transition-colors hover:bg-black hover:text-white dark:border-white dark:hover:bg-white dark:hover:text-black"
          >
            Buy now
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="text-center text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {!loading && !user && (
        <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
          You&apos;ll be asked to sign in with your mobile number or Google.
        </p>
      )}
    </div>
  );
}
