import Link from "next/link";
import { CATEGORIES, getProductsByCategory } from "@/lib/products";
import type { Category } from "@/lib/types";
import { ProductCard } from "@/components/product-card";

export default async function ProductsPage(props: PageProps<"/products">) {
  const { category } = await props.searchParams;
  const activeCategory =
    typeof category === "string" &&
    CATEGORIES.some((c) => c.value === category)
      ? (category as Category)
      : undefined;

  const products = getProductsByCategory(activeCategory);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <h1 className="mb-6 text-2xl font-semibold">
        {activeCategory
          ? CATEGORIES.find((c) => c.value === activeCategory)?.label
          : "All products"}
      </h1>

      <div className="mb-8 flex flex-wrap gap-2 text-sm font-medium">
        <Link
          href="/products"
          className={`rounded-full border px-4 py-1.5 transition-colors ${
            !activeCategory
              ? "border-accent bg-accent text-accent-foreground"
              : "border-black/15 hover:border-black/40 dark:border-white/20 dark:hover:border-white/50"
          }`}
        >
          All
        </Link>
        {CATEGORIES.map((c) => (
          <Link
            key={c.value}
            href={`/products?category=${c.value}`}
            className={`rounded-full border px-4 py-1.5 transition-colors ${
              activeCategory === c.value
                ? "border-accent bg-accent text-accent-foreground"
                : "border-black/15 hover:border-black/40 dark:border-white/20 dark:hover:border-white/50"
            }`}
          >
            {c.label}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}
