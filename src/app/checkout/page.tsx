"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/context/cart-context";
import { useAuth } from "@/context/auth-context";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatPrice } from "@/lib/format";
import { Price } from "@/components/price";
import { digitsOnly } from "@/lib/phone";

/** What place_order returns — enough to confirm the order to the customer. */
type PlacedOrder = {
  order_number: string;
  total: number;
};

/** Maps a place_order failure onto something a customer can act on. */
function checkoutError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("cart is empty")) return "Your cart is empty.";
  if (lower.includes("not signed in")) {
    return "Your session expired. Please sign in again.";
  }
  if (lower.includes("pin_code")) {
    return "That PIN code doesn’t look right — it should be 6 digits.";
  }
  if (lower.includes("violates") || lower.includes("constraint")) {
    return "Some of those details weren’t accepted. Please check and retry.";
  }
  if (lower.includes("fetch") || lower.includes("network")) {
    return "We couldn’t reach the server. Check your connection and retry.";
  }
  return "We couldn’t place your order. Please try again in a moment.";
}

export default function CheckoutPage() {
  const { items, totalPrice, totalListPrice, loading, error: cartError, refresh } =
    useCart();
  const { user } = useAuth();
  const [placed, setPlaced] = useState<PlacedOrder | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Items can only reach the cart while signed in, so prefill what we know
  // rather than making the user retype it.
  const meta = user?.user_metadata ?? {};
  const prefill = {
    name: ((meta.full_name ?? meta.name) as string | undefined) ?? "",
    email: user?.email ?? "",
    phone: user?.phone ? digitsOnly(user.phone).slice(-10) : "",
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError("Checkout is not configured.");
      return;
    }

    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setError(null);

    // Totals are deliberately NOT sent. place_order recomputes them from the
    // products table, so the browser cannot dictate what an order costs.
    const { data, error: rpcError } = await supabase
      .rpc("place_order", {
        p_full_name: String(form.get("fullName") ?? ""),
        p_phone: String(form.get("phone") ?? ""),
        p_email: String(form.get("email") ?? ""),
        p_line1: String(form.get("address") ?? ""),
        p_city: String(form.get("city") ?? ""),
        p_pin_code: String(form.get("pinCode") ?? ""),
      })
      .single();

    if (rpcError) {
      // Postgres messages are for developers: they name functions, columns,
      // and constraints. Log the real one, show the customer something they
      // can act on.
      console.error("place_order failed", rpcError);
      setError(checkoutError(rpcError.message));
      setSubmitting(false);
      return;
    }

    const order = data as PlacedOrder;
    setPlaced(order);
    // place_order clears the cart server-side; sync local state to match.
    await refresh();
    setSubmitting(false);
  }

  if (placed) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 py-16 sm:px-6">
        <h1 className="text-2xl font-semibold">Order placed</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Thanks for your order! Your reference is{" "}
          <span className="font-medium tabular-nums text-foreground">
            {placed.order_number}
          </span>
          {" — "}
          {formatPrice(placed.total)}. We&apos;ll call to confirm delivery.
        </p>
        <Link
          href="/products"
          className="flex h-12 items-center justify-center rounded-full bg-black px-6 font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          Continue shopping
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <p className="text-zinc-500 dark:text-zinc-400">Loading your cart…</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 py-16 sm:px-6">
        <h1 className="text-2xl font-semibold">
          {cartError ? "We couldn’t load your cart" : "Your cart is empty"}
        </h1>
        {cartError && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {cartError}
          </p>
        )}
        <Link
          href="/products"
          className="flex h-12 items-center justify-center rounded-full bg-black px-6 font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          Continue shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 sm:grid-cols-2">
      {/* Remount when the session resolves so the prefilled defaults apply. */}
      <form
        key={user?.id ?? "anonymous"}
        onSubmit={handleSubmit}
        className="flex flex-col gap-4"
      >
        <h1 className="mb-2 text-2xl font-semibold">Checkout</h1>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Full name
          <input
            required
            name="fullName"
            type="text"
            defaultValue={prefill.name}
            className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/20 dark:bg-transparent"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Email
          <input
            required
            name="email"
            type="email"
            defaultValue={prefill.email}
            className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/20 dark:bg-transparent"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Phone number
          <input
            required
            name="phone"
            type="tel"
            pattern="[0-9]{10}"
            placeholder="10-digit mobile number"
            defaultValue={prefill.phone}
            className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/20 dark:bg-transparent"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Address
          <textarea
            required
            name="address"
            rows={3}
            className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/20 dark:bg-transparent"
          />
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium">
            City
            <input
              required
              name="city"
              type="text"
              className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/20 dark:bg-transparent"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            PIN code
            <input
              required
              name="pinCode"
              type="text"
              pattern="[0-9]{6}"
              placeholder="6-digit PIN"
              className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/20 dark:bg-transparent"
            />
          </label>
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 flex h-12 w-full items-center justify-center rounded-full bg-accent px-6 font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {submitting
            ? "Placing order…"
            : `Place order — ${formatPrice(totalPrice)}`}
        </button>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Demo checkout — no real payment will be processed.
        </p>
      </form>

      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Order summary</h2>
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <div
              key={`${item.slug}-${item.size}`}
              className="flex justify-between text-sm"
            >
              <span>
                {item.name} ({item.size}) &times; {item.quantity}
              </span>
              <Price
                price={item.price}
                offerPrice={item.offerPrice}
                discountPercent={item.discountPercent}
                quantity={item.quantity}
              />
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-1 border-t border-black/10 pt-4 dark:border-white/10">
          {totalListPrice > totalPrice && (
            <>
              <div className="flex justify-between text-sm text-zinc-500 dark:text-zinc-400">
                <span>Subtotal</span>
                <span>{formatPrice(totalListPrice)}</span>
              </div>
              <div className="flex justify-between text-sm font-medium text-accent">
                <span>Discount</span>
                <span>−{formatPrice(totalListPrice - totalPrice)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between text-lg font-semibold">
            <span>Total</span>
            <span>{formatPrice(totalPrice)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
