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

    addItem(pending.product, pending.size, pending.quantity);
    setAdded(`${pending.product.name} (${pending.size})`);
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
