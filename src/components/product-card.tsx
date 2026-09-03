import Link from "next/link";
import type { Product } from "@/lib/types";
import { Price } from "./price";
import { ProductImage } from "./product-image";

export function ProductCard({ product }: { product: Product }) {
  // Every size at zero. A product whose variants were not fetched has an empty
  // map, and that is "unknown", not "sold out" — saying otherwise on a listing
  // would talk shoppers out of products that are on the shelf.
  const stock = Object.values(product.stockBySize);
  const soldOut = stock.length > 0 && stock.every((units) => units === 0);

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-black/10 transition-shadow hover:shadow-md dark:border-white/10"
    >
      <div className="relative">
        <ProductImage
          image={product.image}
          name={product.name}
          className={`aspect-square w-full transition-transform group-hover:scale-[1.02] ${
            soldOut ? "opacity-45" : ""
          }`}
        />
        {/* Sits outside ProductImage so the hover zoom moves the photo, not the tag. */}
        {product.discountPercent > 0 && (
          <span className="absolute left-2 top-2 z-10 rounded-full bg-accent px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-accent-foreground shadow-sm">
            {product.discountPercent}% off
          </span>
        )}
        {/* Centred rather than a corner tag: at a glance down a grid, the state
            of the product matters more than the discount it is not available
            at. Still a link — the page explains which sizes went. */}
        {soldOut && (
          <span className="absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 bg-black/75 py-1.5 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-white">
            Sold out
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="text-sm font-medium">{product.name}</h3>
        <Price
          price={product.price}
          offerPrice={product.offerPrice}
          discountPercent={product.discountPercent}
          showBadge={false}
          className="text-zinc-500 dark:text-zinc-400"
        />
      </div>
    </Link>
  );
}
