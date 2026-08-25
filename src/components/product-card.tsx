import Link from "next/link";
import type { Product } from "@/lib/types";
import { Price } from "./price";
import { ProductImage } from "./product-image";

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link
      href={`/products/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-black/10 transition-shadow hover:shadow-md dark:border-white/10"
    >
      <div className="relative">
        <ProductImage
          image={product.image}
          name={product.name}
          className="aspect-square w-full transition-transform group-hover:scale-[1.02]"
        />
        {/* Sits outside ProductImage so the hover zoom moves the photo, not the tag. */}
        {product.discountPercent > 0 && (
          <span className="absolute left-2 top-2 z-10 rounded-full bg-accent px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-accent-foreground shadow-sm">
            {product.discountPercent}% off
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
