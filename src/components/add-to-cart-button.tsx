"use client";

import { useEffect, useState } from "react";
import { useCart } from "@/context/cart-context";
import { useAuth } from "@/context/auth-context";
import { savePendingCartAdd } from "@/lib/pending-cart";
import type { Product } from "@/lib/types";

export function AddToCartButton({ product }: { product: Product }) {
  const { addItem } = useCart();
  const { user, loading, openAuth } = useAuth();
  // A product with no variants left would otherwise send size=undefined to a
  // NOT NULL column. Empty string keeps the guard in addItem meaningful.
  const [size, setSize] = useState(product.sizes[0] ?? "");
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Size</span>
          <div className="flex flex-wrap gap-2">
            {product.sizes.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSize(s)}
                className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                  size === s
                    ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                    : "border-black/15 hover:border-black/40 dark:border-white/20 dark:hover:border-white/50"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => void handleAdd()}
        disabled={loading || busy || product.sizes.length === 0}
        className="flex h-12 w-full items-center justify-center rounded-full bg-accent px-5 font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {busy ? "Adding…" : added ? "Added to cart" : "Add to cart"}
      </button>

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
