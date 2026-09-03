import Link from "next/link";
import { getAllOrders, getCategoryOptions } from "@/lib/admin-catalog";
import { getInventory } from "@/lib/admin-inventory";
import { LOW_STOCK, restockList, summariseOrders } from "@/lib/inventory";
import { formatPrice } from "@/lib/format";
import type { InventoryProduct, SizeLine } from "@/lib/inventory";

export const metadata = { title: "Admin — Dashboard" };

/** Beyond this the restock list stops being a list and becomes the report below. */
const RESTOCK_LIMIT = 20;

export default async function AdminDashboardPage(props: PageProps<"/admin">) {
  const { category } = await props.searchParams;

  const [inventory, orders, categories] = await Promise.all([
    getInventory(),
    getAllOrders(),
    getCategoryOptions(),
  ]);

  const stats = summariseOrders(
    orders.map((order) => ({
      status: order.status,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      total: order.total,
      itemCount: order.itemCount,
    }))
  );

  const { summary } = inventory;
  const restock = restockList(inventory.products);

  const requested = typeof category === "string" ? category : undefined;
  const activeCategory = categories.some((c) => c.slug === requested)
    ? requested
    : undefined;

  // The report defaults to the whole catalog — unlike the products screen,
  // which opens on one category, this is the place you come to compare.
  const rows = activeCategory
    ? inventory.products.filter((p) => p.categorySlug === activeCategory)
    : inventory.products;

  const chipClass = (active: boolean) =>
    `rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
      active
        ? "border-accent bg-accent text-accent-foreground"
        : "border-black/15 hover:border-black/40 dark:border-white/20 dark:hover:border-white/50"
    }`;

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Stock by size, what has sold, and what needs restocking.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="Units in stock" value={summary.unitsInStock} />
          <Tile
            label="Units sold"
            value={summary.unitsSold}
            hint="Cancelled orders excluded"
          />
          <Tile
            label="Sizes sold out"
            value={summary.sizesOut}
            tone={summary.sizesOut > 0 ? "bad" : "plain"}
          />
          <Tile
            label={`Sizes at ${LOW_STOCK} or fewer`}
            value={summary.sizesLow}
            tone={summary.sizesLow > 0 ? "warn" : "plain"}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile
            label="Products sold out"
            value={`${summary.soldOutProducts} of ${summary.products}`}
            hint={
              summary.hiddenProducts > 0
                ? `${summary.hiddenProducts} hidden from the storefront`
                : undefined
            }
            tone={summary.soldOutProducts > 0 ? "bad" : "plain"}
          />
          <Tile
            label="Orders"
            value={stats.orders}
            hint={`${stats.awaitingDispatch} awaiting dispatch`}
          />
          <Tile
            label="Received"
            value={formatPrice(stats.paidRevenue)}
            hint={
              stats.outstanding > 0
                ? `${formatPrice(stats.outstanding)} still owed`
                : undefined
            }
          />
          <Tile
            label="Failed payments"
            value={stats.failedPayments}
            hint={`${stats.codOrders} COD · ${stats.prepaidOrders} online`}
            tone={stats.failedPayments > 0 ? "warn" : "plain"}
          />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">Needs restocking</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {restock.length === 0
              ? `Nothing is at ${LOW_STOCK} units or fewer.`
              : `${restock.length} size${
                  restock.length === 1 ? "" : "s"
                } at ${LOW_STOCK} units or fewer, emptiest first.`}
          </p>
        </div>

        {restock.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[30rem] text-sm">
              <thead>
                <tr className="border-b border-black/10 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-white/10 dark:text-zinc-400">
                  <th className="py-2 pr-3 font-semibold">Product</th>
                  <th className="py-2 pr-3 font-semibold">Size</th>
                  <th className="py-2 pr-3 font-semibold">Left</th>
                  <th className="py-2 pr-3 font-semibold">Sold</th>
                  <th className="py-2 font-semibold" />
                </tr>
              </thead>
              <tbody>
                {restock.slice(0, RESTOCK_LIMIT).map(({ product, line }) => (
                  <tr
                    key={`${product.productId}-${line.size}`}
                    className="border-b border-black/5 dark:border-white/5"
                  >
                    <td className="py-2.5 pr-3">
                      <span className="font-medium">{product.name}</span>
                      {!product.isActive && (
                        <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
                          hidden
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 font-medium">{line.size}</td>
                    <td className="py-2.5 pr-3">
                      <StockNumber stock={line.stock} />
                    </td>
                    <td className="py-2.5 pr-3 text-zinc-600 dark:text-zinc-400">
                      {line.sold}
                    </td>
                    <td className="py-2.5 text-right">
                      <Link
                        href={`/admin/products/${product.productId}`}
                        className="font-medium text-accent underline-offset-2 hover:underline"
                      >
                        Restock
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {restock.length > RESTOCK_LIMIT && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {restock.length - RESTOCK_LIMIT} more below the mark — the full
            picture is in the table underneath.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">Stock by size</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Every size of every product, emptiest product first.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin"
            aria-current={activeCategory ? undefined : "page"}
            className={chipClass(!activeCategory)}
          >
            All · {inventory.products.length}
          </Link>
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/admin?category=${c.slug}`}
              aria-current={activeCategory === c.slug ? "page" : undefined}
              className={chipClass(activeCategory === c.slug)}
            >
              {c.label} ·{" "}
              {
                inventory.products.filter((p) => p.categorySlug === c.slug)
                  .length
              }
            </Link>
          ))}
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No products here yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-sm">
              <thead>
                <tr className="border-b border-black/10 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-white/10 dark:text-zinc-400">
                  <th className="py-2 pr-3 font-semibold">Size</th>
                  <th className="py-2 pr-3 font-semibold">In stock</th>
                  <th className="py-2 pr-3 font-semibold">Sold</th>
                  <th className="py-2 font-semibold" />
                </tr>
              </thead>
              {rows.map((product) => (
                <ProductBlock key={product.productId} product={product} />
              ))}
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

/** One product: a heading row with its totals, then a row per size. */
function ProductBlock({ product }: { product: InventoryProduct }) {
  return (
    <tbody>
      <tr>
        <th
          colSpan={4}
          className="pt-6 pb-2 text-left align-bottom font-semibold"
        >
          <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <Link
              href={`/admin/products/${product.productId}`}
              className="underline-offset-2 hover:underline"
            >
              {product.name}
            </Link>
            <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
              {product.categorySlug} · {product.stock} in stock ·{" "}
              {product.sold} sold
            </span>
            {product.soldOut && (
              <span className="rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-xs font-semibold text-red-800 dark:text-red-200">
                Out of stock
              </span>
            )}
            {!product.isActive && (
              <span className="rounded-full border border-black/15 px-2 py-0.5 text-xs font-semibold text-zinc-600 dark:border-white/20 dark:text-zinc-400">
                Hidden
              </span>
            )}
          </span>
        </th>
      </tr>

      {product.sizes.map((line) => (
        <SizeRow key={line.size} line={line} />
      ))}
    </tbody>
  );
}

function SizeRow({ line }: { line: SizeLine }) {
  return (
    <tr className="border-b border-black/5 dark:border-white/5">
      <td className="py-2 pr-3 font-medium">{line.size}</td>
      <td className="py-2 pr-3">
        <StockNumber stock={line.stock} />
      </td>
      <td className="py-2 pr-3 text-zinc-600 dark:text-zinc-400">
        {line.sold}
      </td>
      <td className="py-2 text-right text-xs text-zinc-500 dark:text-zinc-400">
        {line.stock === 0
          ? "not buyable"
          : line.stock <= LOW_STOCK
            ? "low"
            : ""}
      </td>
    </tr>
  );
}

/** Zero reads as a problem, not as a number. */
function StockNumber({ stock }: { stock: number }) {
  if (stock === 0) {
    return (
      <span className="font-semibold text-red-700 dark:text-red-400">0</span>
    );
  }
  if (stock <= LOW_STOCK) {
    return (
      <span className="font-semibold text-amber-700 dark:text-amber-500">
        {stock}
      </span>
    );
  }
  return <span>{stock}</span>;
}

function Tile({
  label,
  value,
  hint,
  tone = "plain",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "plain" | "warn" | "bad";
}) {
  const valueTone =
    tone === "bad"
      ? "text-red-700 dark:text-red-400"
      : tone === "warn"
        ? "text-amber-700 dark:text-amber-500"
        : "";

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-black/10 p-4 dark:border-white/10">
      <span className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      <span className={`text-2xl font-semibold tabular-nums ${valueTone}`}>
        {value}
      </span>
      {hint && (
        <span className="text-xs text-zinc-500 dark:text-zinc-400">{hint}</span>
      )}
    </div>
  );
}
