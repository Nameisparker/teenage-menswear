"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAuth } from "./auth-context";
import type { CartItem, Product } from "@/lib/types";

/**
 * The cart lives in the database (public.cart_items), not localStorage, so it
 * follows the customer across devices and survives clearing site data.
 *
 * Adding to the cart requires a session (see AddToCartButton), so a signed-out
 * visitor simply has an empty cart — there is no anonymous cart to merge.
 */

type CartContextValue = {
  items: CartItem[];
  /** True while the cart is being fetched for the current session. */
  loading: boolean;
  error: string | null;
  addItem: (product: Product, size: string, quantity?: number) => Promise<void>;
  removeItem: (slug: string, size: string) => Promise<void>;
  updateQuantity: (
    slug: string,
    size: string,
    quantity: number
  ) => Promise<void>;
  clearCart: () => Promise<void>;
  /** Re-reads from the database, e.g. after checkout clears it server-side. */
  refresh: () => Promise<void>;
  totalItems: number;
  totalPrice: number;
};

const CartContext = createContext<CartContextValue | null>(null);

/** Row shape returned by the cart select below. */
type CartRow = {
  id: string;
  product_id: string;
  size: string;
  quantity: number;
  products: {
    slug: string;
    name: string;
    price: number;
    image_path: string;
  } | null;
};

const CART_SELECT =
  "id, product_id, size, quantity, products!inner ( slug, name, price, image_path )";

export function CartProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();

    if (!supabase || !user) {
      setItems([]);
      setLoading(false);
      return;
    }

    const { data, error: loadError } = await supabase
      .from("cart_items")
      .select(CART_SELECT)
      .order("created_at");

    if (loadError) {
      setError(loadError.message);
      setLoading(false);
      return;
    }

    setError(null);
    setItems(
      (data as unknown as CartRow[])
        // products is NOT NULL via the inner join, but stay defensive so one
        // odd row cannot blank the whole cart.
        .filter((row) => row.products)
        .map((row) => ({
          productId: row.product_id,
          slug: row.products!.slug,
          name: row.products!.name,
          price: row.products!.price,
          size: row.size,
          image: row.products!.image_path,
          quantity: row.quantity,
        }))
    );
    setLoading(false);
  }, [user]);

  // Reload whenever the session changes: sign-in pulls the saved cart, sign-out
  // empties it locally.
  useEffect(() => {
    if (authLoading) return;
    void load();
  }, [authLoading, load]);

  const addItem = useCallback(
    async (product: Product, size: string, quantity = 1) => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !user) return;

      // RPC rather than upsert: incrementing an existing row is not expressible
      // as a plain upsert, and read-then-write races with a double click.
      const { error: rpcError } = await supabase.rpc("add_to_cart", {
        p_product_id: product.id,
        p_size: size,
        p_qty: quantity,
      });

      if (rpcError) {
        setError(rpcError.message);
        return;
      }
      await load();
    },
    [user, load]
  );

  const removeItem = useCallback(
    async (slug: string, size: string) => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !user) return;

      const target = items.find(
        (item) => item.slug === slug && item.size === size
      );
      if (!target) return;

      const { error: deleteError } = await supabase
        .from("cart_items")
        .delete()
        .eq("product_id", target.productId)
        .eq("size", size);

      if (deleteError) {
        setError(deleteError.message);
        return;
      }
      await load();
    },
    [user, items, load]
  );

  const updateQuantity = useCallback(
    async (slug: string, size: string, quantity: number) => {
      if (quantity <= 0) {
        await removeItem(slug, size);
        return;
      }

      const supabase = getSupabaseBrowserClient();
      if (!supabase || !user) return;

      const target = items.find(
        (item) => item.slug === slug && item.size === size
      );
      if (!target) return;

      const { error: updateError } = await supabase
        .from("cart_items")
        .update({ quantity })
        .eq("product_id", target.productId)
        .eq("size", size);

      if (updateError) {
        setError(updateError.message);
        return;
      }
      await load();
    },
    [user, items, load, removeItem]
  );

  const clearCart = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user) return;

    // RLS scopes this to the caller's own rows, so no user_id filter is needed —
    // but pass it anyway to make the intent explicit at the call site.
    const { error: clearError } = await supabase
      .from("cart_items")
      .delete()
      .eq("user_id", user.id);

    if (clearError) {
      setError(clearError.message);
      return;
    }
    setItems([]);
  }, [user]);

  const totalItems = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );
  const totalPrice = useMemo(
    () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [items]
  );

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      loading: loading || authLoading,
      error,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      refresh: load,
      totalItems,
      totalPrice,
    }),
    [
      items,
      loading,
      authLoading,
      error,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      load,
      totalItems,
      totalPrice,
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
