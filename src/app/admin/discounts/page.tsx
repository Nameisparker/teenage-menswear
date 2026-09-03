import { getAllProducts } from "@/lib/admin-catalog";
import { formatPrice } from "@/lib/format";
import { DiscountRow } from "@/components/discount-row";

export const metadata = { title: "Admin — Discounts" };

export default async function AdminDiscountsPage() {
  const products = await getAllProducts();
  const onOffer = products.filter((product) => product.discountPercent > 0);

  // Only meaningful for products actually on the storefront — a hidden product
  // at 40% off is not an offer anyone can take.
  const liveOffers = onOffer.filter((product) => product.isActive);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Discounts</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {onOffer.length === 0
            ? "Nothing is on offer. Set a percentage to start one."
            : `${liveOffers.length} live offer${liveOffers.length === 1 ? "" : "s"}` +
              (onOffer.length > liveOffers.length
                ? ` · ${onOffer.length - liveOffers.length} on hidden products`
                : "")}
        </p>
      </div>

      {onOffer.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {onOffer.map((product) => (
            <span
              key={product.id}
              className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-medium text-accent"
            >
              {product.name} · {product.discountPercent}% off ·{" "}
              {formatPrice(product.offerPrice)}
            </span>
          ))}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[46rem] text-sm">
          <thead>
            <tr className="border-b border-black/10 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-white/10 dark:text-zinc-400">
              <th className="sticky left-0 z-10 bg-background py-2 pr-3 font-semibold">
                Product
              </th>
              <th className="py-2 pr-3 font-semibold">Price</th>
              <th className="py-2 pr-3 font-semibold">Discount</th>
              <th className="py-2 pr-3 font-semibold">Offer price</th>
              <th className="py-2 font-semibold" />
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <DiscountRow key={product.id} product={product} />
            ))}
          </tbody>
        </table>
      </div>

      {products.length === 0 && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No products yet. Add one first.
        </p>
      )}
    </div>
  );
}
