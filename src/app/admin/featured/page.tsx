import Link from "next/link";
import { getAllProducts, getCategoryOptions } from "@/lib/admin-catalog";
import { formatPrice } from "@/lib/format";
import { ProductImage } from "@/components/product-image";
import { FeaturedToggle } from "@/components/featured-toggle";
import type { AdminProduct } from "@/lib/admin-catalog";

export const metadata = { title: "Admin — Featured" };

/** One row, shared by both tables so the two lists stay visually identical. */
function ProductRow({ product }: { product: AdminProduct }) {
  return (
    <tr className="border-b border-black/5 dark:border-white/5">
      <td className="sticky left-0 z-10 bg-background py-3 pr-3">
        <div className="flex items-center gap-3">
          <ProductImage
            image={product.imagePath}
            name={product.name}
            className="h-10 w-10 flex-shrink-0 rounded"
            sizes="40px"
          />
          <div className="flex flex-col">
            <Link
              href={`/admin/products/${product.id}`}
              className="font-medium underline-offset-2 hover:underline"
            >
              {product.name}
            </Link>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {product.categorySlug}
            </span>
          </div>
        </div>
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
      <td className="py-3 pr-3">
        {product.isActive ? (
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Live</span>
        ) : (
          <span className="rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-xs font-semibold text-red-800 dark:text-red-200">
            Hidden
          </span>
        )}
      </td>
      <td className="py-3 text-right">
        <FeaturedToggle
          productId={product.id}
          name={product.name}
          featured={product.featured}
        />
      </td>
    </tr>
  );
}

function TableHead() {
  return (
    <thead>
      <tr className="border-b border-black/10 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-white/10 dark:text-zinc-400">
        <th className="sticky left-0 z-10 bg-background py-2 pr-3 font-semibold">
          Product
        </th>
        <th className="py-2 pr-3 font-semibold">Price</th>
        <th className="py-2 pr-3 font-semibold">Status</th>
        <th className="py-2 font-semibold" />
      </tr>
    </thead>
  );
}

export default async function AdminFeaturedPage() {
  const [products, categories] = await Promise.all([
    getAllProducts(),
    getCategoryOptions(),
  ]);

  const featured = products.filter((product) => product.featured);
  const rest = products.filter((product) => !product.featured);
  // Featured but hidden is the one combination that silently does nothing: the
  // home page reads the flag, the storefront policy hides the product.
  const hidden = featured.filter((product) => !product.isActive).length;

  // Ordered by the category list, not by whatever order the products came back
  // in, so the picker below matches the storefront's own ordering.
  const groups = categories
    .map((category) => ({
      ...category,
      items: rest.filter((product) => product.categorySlug === category.slug),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">Featured items</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {featured.length === 0
              ? "Nothing is featured. Pick products below to put them on the home page."
              : `${featured.length} on the home page` +
                (hidden > 0
                  ? ` · ${hidden} of them hidden from the storefront`
                  : "")}
          </p>
        </div>

        {featured.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <TableHead />
              <tbody>
                {featured.map((product) => (
                  <ProductRow key={product.id} product={product} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {groups.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Add to featured</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <TableHead />
              {groups.map((group) => (
                <tbody key={group.id}>
                  <tr>
                    <th
                      colSpan={4}
                      className="pt-6 pb-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
                    >
                      {group.label} · {group.items.length}
                    </th>
                  </tr>
                  {group.items.map((product) => (
                    <ProductRow key={product.id} product={product} />
                  ))}
                </tbody>
              ))}
            </table>
          </div>
        </section>
      )}

      {products.length === 0 && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No products yet. Add one first.
        </p>
      )}
    </div>
  );
}
