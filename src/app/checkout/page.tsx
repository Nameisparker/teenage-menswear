"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/context/cart-context";
import { formatPrice } from "@/lib/format";

export default function CheckoutPage() {
  const { items, totalPrice, clearCart } = useCart();
  const [placed, setPlaced] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    clearCart();
    setPlaced(true);
  }

  if (placed) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 py-16 sm:px-6">
        <h1 className="text-2xl font-semibold">Order placed</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Thanks for your order! This is a demo checkout, so no payment was
          taken.
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

  if (items.length === 0) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 py-16 sm:px-6">
        <h1 className="text-2xl font-semibold">Your cart is empty</h1>
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
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <h1 className="mb-2 text-2xl font-semibold">Checkout</h1>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Full name
          <input
            required
            type="text"
            className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/20 dark:bg-transparent"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Email
          <input
            required
            type="email"
            className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/20 dark:bg-transparent"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Phone number
          <input
            required
            type="tel"
            pattern="[0-9]{10}"
            placeholder="10-digit mobile number"
            className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/20 dark:bg-transparent"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Address
          <textarea
            required
            rows={3}
            className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/20 dark:bg-transparent"
          />
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium">
            City
            <input
              required
              type="text"
              className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/20 dark:bg-transparent"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            PIN code
            <input
              required
              type="text"
              pattern="[0-9]{6}"
              placeholder="6-digit PIN"
              className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/20 dark:bg-transparent"
            />
          </label>
        </div>

        <button
          type="submit"
          className="mt-2 flex h-12 w-full items-center justify-center rounded-full bg-accent px-6 font-medium text-accent-foreground transition-opacity hover:opacity-90"
        >
          Place order — {formatPrice(totalPrice)}
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
              <span>{formatPrice(item.price * item.quantity)}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-between border-t border-black/10 pt-4 text-lg font-semibold dark:border-white/10">
          <span>Total</span>
          <span>{formatPrice(totalPrice)}</span>
        </div>
      </div>
    </div>
  );
}
