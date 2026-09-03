"use client";

import Link from "next/link";
import { useCart } from "@/context/cart-context";
import { formatPrice } from "@/lib/format";
import { ProductImage } from "@/components/product-image";
import { Price } from "@/components/price";

export default function CartPage() {
  const {
    items,
    updateQuantity,
    removeItem,
    totalPrice,
    totalListPrice,
    loading,
    error,
  } = useCart();

  // Without this the cart flashes "empty" before the fetch resolves.
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
          {error ? "We couldn’t load your cart" : "Your cart is empty"}
        </h1>
        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
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
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <h1 className="mb-8 text-2xl font-semibold">Your cart</h1>

      {error && (
        <p
          role="alert"
          className="mb-6 rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300"
        >
          {error}
        </p>
      )}

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
                  {/* place_order refuses the whole order over a single short
                      line, so saying it here — where the quantity can be
                      changed — beats letting checkout be the first to mention
                      it. */}
                  {item.stock === 0 ? (
                    <p className="mt-1 text-sm font-medium text-red-600 dark:text-red-400">
                      Sold out — remove this to check out.
                    </p>
                  ) : (
                    item.quantity > item.stock && (
                      <p className="mt-1 text-sm font-medium text-red-600 dark:text-red-400">
                        Only {item.stock} left. Reduce the quantity to check out.
                      </p>
                    )
                  )}
                </div>
                <Price
                  price={item.price}
                  offerPrice={item.offerPrice}
                  discountPercent={item.discountPercent}
                  quantity={item.quantity}
                  className="font-medium"
                />
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      void updateQuantity(item.slug, item.size, item.quantity - 1)
                    }
                    className="flex h-10 w-10 items-center justify-center rounded-md border border-black/15 sm:h-8 sm:w-8 dark:border-white/20"
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
                      void updateQuantity(item.slug, item.size, item.quantity + 1)
                    }
                    disabled={item.quantity >= item.stock}
                    className="flex h-10 w-10 items-center justify-center rounded-md border border-black/15 disabled:opacity-40 sm:h-8 sm:w-8 dark:border-white/20"
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => void removeItem(item.slug, item.size)}
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
        <div className="flex w-full max-w-xs flex-col gap-1 sm:w-64">
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
