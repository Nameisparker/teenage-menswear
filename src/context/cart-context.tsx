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

export type CartWriteResult = { ok: boolean; error?: string };

type CartContextValue = {
  items: CartItem[];
  /** True while the cart is being fetched for the current session. */
  loading: boolean;
  error: string | null;
  /**
   * Resolves to the outcome. Callers must not report success on their own:
   * an add can fail on RLS, a dropped connection, or a retired product, and
   * a button that says “Added to cart” regardless is lying.
   */
  addItem: (
    product: Product,
    size: string,
    quantity?: number
  ) => Promise<CartWriteResult>;
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
  /** What the cart actually costs — offer prices, not list prices. */
  totalPrice: number;
  /** The same cart at list prices. Equal to totalPrice when nothing is on offer. */
  totalListPrice: number;
};

const CartContext = createContext<CartContextValue | null>(null);

/** Stable identity, so a signed-out render does not invalidate the memos below. */
const EMPTY_CART: CartItem[] = [];

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
    discount_percent: number;
    offer_price: number;
    image_path: string;
  } | null;
};

/** What one cart read produced: rows, a failure, or nothing to do. */
type CartFetch =
  | { userId: string; items: CartItem[] }
  | { userId: string; error: string }
  | null;

const CART_SELECT =
  "id, product_id, size, quantity, products!inner ( slug, name, price, discount_percent, offer_price, image_path )";

export function CartProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  // Rows as last fetched, tagged with the session they were fetched for.
  const [fetched, setFetched] = useState<{
    userId: string;
    items: CartItem[];
  } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // All three are derived rather than cleared on sign-out. That keeps the
  // effect below free of synchronous setState, and means one customer’s cart
  // can never be shown under another’s session while a fetch is in flight.
  const mine = user != null && fetched?.userId === user.id;
  const items = mine ? fetched.items : EMPTY_CART;
  const error = user ? loadError : null;
  const loading = authLoading || (user != null && !mine && loadError === null);

  // Fetching and state-writing are kept apart so the effect below can hand the
  // write to a promise callback: React must not be told to re-render straight
  // from an effect body.
  const fetchCart = useCallback(async (): Promise<CartFetch> => {
    const supabase = getSupabaseBrowserClient();

    // Nothing to fetch when signed out; `items` already reads as empty.
    if (!supabase || !user) return null;

    const { data, error: readError } = await supabase
      .from("cart_items")
      .select(CART_SELECT)
      .order("created_at");

    if (readError) return { userId: user.id, error: readError.message };

    return {
      userId: user.id,
      items: (data as unknown as CartRow[])
        // products is NOT NULL via the inner join, but stay defensive so one
        // odd row cannot blank the whole cart.
        .filter((row) => row.products)
        .map((row) => ({
          productId: row.product_id,
          slug: row.products!.slug,
          name: row.products!.name,
          price: row.products!.price,
          discountPercent: row.products!.discount_percent,
          offerPrice: row.products!.offer_price,
          size: row.size,
          image: row.products!.image_path,
          quantity: row.quantity,
        })),
    };
  }, [user]);

  const applyFetch = useCallback((result: CartFetch) => {
    if (!result) return;
    if ("error" in result) {
      setLoadError(result.error);
      return;
    }
    setLoadError(null);
    setFetched(result);
  }, []);

  /**
   * Applies an edit to the rows already on screen, without a round trip.
   *
   * Quantity and removal both change a line the browser already has complete
   * price data for, so the recomputed total is exact rather than a guess. The
   * write still goes to the database; if it fails the caller re-reads, and the
   * server wins.
   */
  const patchItems = useCallback(
    (userId: string, update: (items: CartItem[]) => CartItem[]) => {
      setFetched((current) =>
        current && current.userId === userId
          ? { userId, items: update(current.items) }
          : current
      );
    },
    []
  );

  /** Re-reads the cart. Used on failure to reconcile, and exposed as `refresh`. */
  const load = useCallback(async () => {
    applyFetch(await fetchCart());
  }, [fetchCart, applyFetch]);

  // Reload whenever the session changes: signing in pulls the saved cart, and
  // signing out needs no work at all because the cart is derived from `user`.
  useEffect(() => {
    if (authLoading) return;

    let cancelled = false;
    void fetchCart().then((result) => {
      if (!cancelled) applyFetch(result);
    });

    return () => {
      cancelled = true;
    };
  }, [authLoading, fetchCart, applyFetch]);

  const addItem = useCallback(
    async (
      product: Product,
      size: string,
      quantity = 1
    ): Promise<CartWriteResult> => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return { ok: false, error: "Cart is not configured." };
      if (!user) return { ok: false, error: "Please sign in first." };

      if (!size) {
        return { ok: false, error: "Pick a size first." };
      }

      // RPC rather than upsert: incrementing an existing row is not expressible
      // as a plain upsert, and read-then-write races with a double click.
      const { error: rpcError } = await supabase.rpc("add_to_cart", {
        p_product_id: product.id,
        p_size: size,
        p_qty: quantity,
      });

      if (rpcError) {
        setLoadError(rpcError.message);
        return { ok: false, error: rpcError.message };
      }
      await load();
      return { ok: true };
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

      patchItems(user.id, (current) =>
        current.filter(
          (item) =>
            !(item.productId === target.productId && item.size === size)
        )
      );

      const { error: deleteError } = await supabase
        .from("cart_items")
        .delete()
        .eq("product_id", target.productId)
        .eq("size", size);

      if (deleteError) {
        setLoadError(deleteError.message);
        await load();
      }
    },
    [user, items, load, patchItems]
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

      patchItems(user.id, (current) =>
        current.map((item) =>
          item.productId === target.productId && item.size === size
            ? { ...item, quantity }
            : item
        )
      );

      const { error: updateError } = await supabase
        .from("cart_items")
        .update({ quantity })
        .eq("product_id", target.productId)
        .eq("size", size);

      if (updateError) {
        setLoadError(updateError.message);
        await load();
      }
    },
    [user, items, load, removeItem, patchItems]
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
      setLoadError(clearError.message);
      return;
    }
    setFetched({ userId: user.id, items: [] });
  }, [user]);

  const totalItems = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );
  // Charges the offer price. The database re-derives this total in
  // place_order(), so a stale client here cannot change what is billed.
  const totalPrice = useMemo(
    () => items.reduce((sum, item) => sum + item.offerPrice * item.quantity, 0),
    [items]
  );
  const totalListPrice = useMemo(
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
      totalListPrice,
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
      totalListPrice,
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
