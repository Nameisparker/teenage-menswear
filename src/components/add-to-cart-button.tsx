"use client";

import { useState } from "react";
import { useCart } from "@/context/cart-context";
import { useAuth } from "@/context/auth-context";
import { savePendingCartAdd } from "@/lib/pending-cart";
import type { Product } from "@/lib/types";

export function AddToCartButton({ product }: { product: Product }) {
  const { addItem } = useCart();
  const { user, loading, openAuth } = useAuth();
  const [size, setSize] = useState(product.sizes[0]);
  const [added, setAdded] = useState(false);

  function handleAdd() {
    // Not signed in: park the intent and let the modal take over. PendingCartAdd
    // finishes the add once sign-in succeeds, including after a Google redirect.
    if (!user) {
      savePendingCartAdd(product, size);
      openAuth();
      return;
    }

    addItem(product, size);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
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
        onClick={handleAdd}
        disabled={loading}
        className="flex h-12 w-full items-center justify-center rounded-full bg-accent px-5 font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {added ? "Added to cart" : "Add to cart"}
      </button>

      {!loading && !user && (
        <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
          You&apos;ll be asked to sign in with your mobile number or Google.
        </p>
      )}
    </div>
  );
}
