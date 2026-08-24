"use client";

import Link from "next/link";
import { useCart } from "@/context/cart-context";
import { formatPrice } from "@/lib/format";
import { ProductImage } from "@/components/product-image";

export default function CartPage() {
  const { items, updateQuantity, removeItem, totalPrice } = useCart();

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
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <h1 className="mb-8 text-2xl font-semibold">Your cart</h1>

      <div className="flex flex-col gap-6">
        {items.map((item) => (
          <div
            key={`${item.slug}-${item.size}`}
            className="flex gap-4 border-b border-black/10 pb-6 dark:border-white/10"
          >
            <ProductImage
              image={item.image}
              name={item.name}
              className="h-24 w-24 flex-shrink-0 rounded-md"
              sizes="96px"
            />

            <div className="flex flex-1 flex-col justify-between">
              <div className="flex justify-between gap-4">
                <div>
                  <Link
                    href={`/products/${item.slug}`}
                    className="font-medium hover:underline"
                  >
                    {item.name}
                  </Link>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Size: {item.size}
                  </p>
                </div>
                <p className="font-medium">
                  {formatPrice(item.price * item.quantity)}
                </p>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      updateQuantity(item.slug, item.size, item.quantity - 1)
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-md border border-black/15 dark:border-white/20"
                    aria-label="Decrease quantity"
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-sm">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      updateQuantity(item.slug, item.size, item.quantity + 1)
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-md border border-black/15 dark:border-white/20"
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(item.slug, item.size)}
                  className="text-sm text-zinc-500 hover:text-black hover:underline dark:text-zinc-400 dark:hover:text-white"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-col items-end gap-4">
        <div className="flex w-full max-w-xs justify-between text-lg font-semibold sm:w-64">
          <span>Total</span>
          <span>{formatPrice(totalPrice)}</span>
        </div>
        <Link
          href="/checkout"
          className="flex h-12 w-full max-w-xs items-center justify-center rounded-full bg-accent px-6 font-medium text-accent-foreground transition-opacity hover:opacity-90 sm:w-64"
        >
          Checkout
        </Link>
      </div>
    </div>
  );
}
