"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { useCart } from "@/context/cart-context";
import { takePendingCartAdd } from "@/lib/pending-cart";

/**
 * Completes the add-to-cart the user was blocked on before signing in. Lives in
 * the layout because Google sign-in navigates away from the product page, so
 * whichever page the callback returns to has to be able to finish the job.
 */
export function PendingCartAdd() {
  const { user, loading } = useAuth();
  const { addItem } = useCart();
  const [added, setAdded] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !user) return;

    const pending = takePendingCartAdd();
    if (!pending) return;

    // Announce after the add has actually landed, not before it: the toast
    // says "Added to cart", and setting state from a promise callback also
    // keeps this effect from re-rendering synchronously.
    void addItem(pending.product, pending.size, pending.quantity).then(
      (result) => {
        // Only announce a replay that actually succeeded. The intent was
        // already consumed from storage above, so a silent failure here would
        // lose the item with the customer believing it was added.
        if (result.ok) setAdded(`${pending.product.name} (${pending.size})`);
      }
    );
  }, [user, loading, addItem]);

  useEffect(() => {
    if (!added) return;
    const timer = setTimeout(() => setAdded(null), 3000);
    return () => clearTimeout(timer);
  }, [added]);

  if (!added) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-full bg-black px-5 py-3 text-sm font-medium text-white shadow-lg dark:bg-white dark:text-black"
    >
      Added to cart — {added}
    </div>
  );
}
