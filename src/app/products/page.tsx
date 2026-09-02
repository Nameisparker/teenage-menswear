import Link from "next/link";
import { getCategories, getProductsByCategory } from "@/lib/catalog";
import { ProductCard } from "@/components/product-card";
import { ProductFilters } from "@/components/product-filters";
import {
  DEFAULT_SORT,
  applyProductQuery,
  availableSizes,
  hasActiveFilters,
  parseProductQuery,
} from "@/lib/product-filters";

/** Re-fetch the catalog at most once a minute so edits show up without a deploy. */
export const revalidate = 60;

export default async function ProductsPage(props: PageProps<"/products">) {
  const searchParams = await props.searchParams;
  const { category } = searchParams;
  const CATEGORIES = await getCategories();

  // Validate against the fetched list — the set of categories is data now, so
  // an unknown ?category= must fall back to "all" rather than query for it.
  const activeCategory =
    typeof category === "string" && CATEGORIES.some((c) => c.value === category)
      ? category
      : undefined;

  const products = await getProductsByCategory(activeCategory);

  const query = parseProductQuery(searchParams);
  // Size options come from the category's full result set, before filtering,
  // so picking "M" does not make every other size disappear from the row.
  const sizes = availableSizes(products);
  const visible = applyProductQuery(products, query);

  // Handed to the filter bar so it can edit the current URL without reading
  // useSearchParams() — see the note on ProductFilters.
  const search = new URLSearchParams(
    Object.entries(searchParams).flatMap(([key, value]) =>
      Array.isArray(value)
        ? value.map((entry) => [key, entry] as [string, string])
        : value === undefined
          ? []
          : [[key, value] as [string, string]]
    )
  ).toString();

  // Category is a different axis from the rest, so switching it keeps the
  // chosen sort but drops the filters, whose options are category-specific.
  const categoryHref = (value?: string) => {
    const params = new URLSearchParams();
    if (value) params.set("category", value);
    if (query.sort !== DEFAULT_SORT) params.set("sort", query.sort);
    const next = params.toString();
    return next ? `/products?${next}` : "/products";
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <h1 className="mb-6 text-2xl font-semibold">
        {activeCategory
          ? CATEGORIES.find((c) => c.value === activeCategory)?.label
          : "All products"}
      </h1>

      <div className="flex flex-wrap gap-2 text-sm font-medium">
        <Link
          href={categoryHref()}
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
            href={categoryHref(c.value)}
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

      <ProductFilters
        search={search}
        sizes={sizes}
        query={query}
        resultCount={visible.length}
      />

      {visible.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <p className="py-16 text-center text-sm text-zinc-500 dark:text-zinc-400">
          {hasActiveFilters(query)
            ? "No products match these filters. Try widening the price range or clearing a size."
            : "No products in this category yet."}
        </p>
      )}
    </div>
  );
}
