import Link from "next/link";
import type { Product } from "@/lib/types";
import { formatPrice } from "@/lib/format";
import { ProductImage } from "./product-image";

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link
      href={`/products/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-black/10 transition-shadow hover:shadow-md dark:border-white/10"
    >
      <ProductImage
        image={product.image}
        name={product.name}
        className="aspect-square w-full transition-transform group-hover:scale-[1.02]"
      />
      <div className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="text-sm font-medium">{product.name}</h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {formatPrice(product.price)}
        </p>
      </div>
    </Link>
  );
}
