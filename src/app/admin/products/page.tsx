import Link from "next/link";
import { getAllProducts, getCategoryOptions } from "@/lib/admin-catalog";
import { formatPrice } from "@/lib/format";
import { ProductImage } from "@/components/product-image";

export const metadata = { title: "Admin — Products" };

export default async function AdminProductsPage(
  props: PageProps<"/admin/products">
) {
  const { category } = await props.searchParams;
  const [products, categories] = await Promise.all([
    getAllProducts(),
    getCategoryOptions(),
  ]);

  const requested = typeof category === "string" ? category : undefined;
  /**
   * One category at a time by default. The whole catalog in one table is a
   * scroll, not a list — an admin editing shirts should not have to pass the
   * jeans to get there. ?category=all is still there for a catalog-wide look.
   */
  const activeCategory =
    requested === "all"
      ? undefined
      : categories.some((c) => c.slug === requested)
        ? requested
        : categories[0]?.slug;

  const visible = activeCategory
    ? products.filter((product) => product.categorySlug === activeCategory)
    : products;
  const inactive = visible.filter((product) => !product.isActive).length;

  const countFor = (slug: string) =>
    products.filter((product) => product.categorySlug === slug).length;

  const tabClass = (active: boolean) =>
    `rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
      active
        ? "border-accent bg-accent text-accent-foreground"
        : "border-black/15 hover:border-black/40 dark:border-white/20 dark:hover:border-white/50"
    }`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">
          {activeCategory
            ? (categories.find((c) => c.slug === activeCategory)?.label ??
              "Products")
            : "All products"}
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {visible.length} of {products.length}
          {inactive > 0 && ` · ${inactive} hidden from the storefront`}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/admin/products?category=${c.slug}`}
            aria-current={activeCategory === c.slug ? "page" : undefined}
            className={tabClass(activeCategory === c.slug)}
          >
            {c.label} · {countFor(c.slug)}
          </Link>
        ))}
        <Link
          href="/admin/products?category=all"
          aria-current={activeCategory ? undefined : "page"}
          className={tabClass(!activeCategory)}
        >
          All · {products.length}
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[46rem] text-sm">
          <thead>
            <tr className="border-b border-black/10 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-white/10 dark:text-zinc-400">
              <th className="py-2 pr-3 font-semibold">Product</th>
              <th className="py-2 pr-3 font-semibold">Category</th>
              <th className="py-2 pr-3 font-semibold">Price</th>
              <th className="py-2 pr-3 font-semibold">Sizes</th>
              <th className="py-2 pr-3 font-semibold">Status</th>
              <th className="py-2 font-semibold" />
            </tr>
          </thead>
          <tbody>
            {visible.map((product) => (
              <tr
                key={product.id}
                className="border-b border-black/5 dark:border-white/5"
              >
                <td className="py-3 pr-3">
                  <div className="flex items-center gap-3">
                    <ProductImage
                      image={product.imagePath}
                      name={product.name}
                      className="h-10 w-10 flex-shrink-0 rounded"
                      sizes="40px"
                    />
                    <div className="flex flex-col">
                      <span className="font-medium">{product.name}</span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        {product.slug}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="py-3 pr-3 text-zinc-600 dark:text-zinc-400">
                  {product.categorySlug}
                </td>
                <td className="py-3 pr-3 whitespace-nowrap">
                  {product.discountPercent > 0 ? (
                    <div className="flex flex-col">
                      <span className="font-medium text-accent">
                        {formatPrice(product.offerPrice)}
                      </span>
                      <span className="text-xs text-zinc-500 line-through dark:text-zinc-400">
                        {formatPrice(product.price)}
                      </span>
                    </div>
                  ) : (
                    formatPrice(product.price)
                  )}
                </td>
                <td className="py-3 pr-3 text-zinc-600 dark:text-zinc-400">
                  {product.sizes.join(", ") || "—"}
                </td>
                <td className="py-3 pr-3">
                  <div className="flex flex-wrap gap-1">
                    {!product.isActive && (
                      <span className="rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-xs font-semibold text-red-800 dark:text-red-200">
                        Hidden
                      </span>
                    )}
                    {product.discountPercent > 0 && (
                      <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
                        {product.discountPercent}% off
                      </span>
                    )}
                    {product.featured && (
                      <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
                        Featured
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-3 text-right">
                  <Link
                    href={`/admin/products/${product.id}`}
                    className="font-medium text-accent underline-offset-2 hover:underline"
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {visible.length === 0 && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {products.length === 0
            ? "No products yet. Add one first."
            : "Nothing in this category yet."}
        </p>
      )}
    </div>
  );
}
