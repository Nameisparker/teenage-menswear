import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminOrderByNumber } from "@/lib/admin-catalog";
import { formatPrice } from "@/lib/format";
import { STATUS_LABELS } from "@/lib/order-status";
import { ProductImage } from "@/components/product-image";
import { StatusBadge } from "@/components/status-badge";
import { OrderStatusControl } from "@/components/order-status-control";

export async function generateMetadata(
  props: PageProps<"/admin/orders/[orderNumber]">
) {
  const { orderNumber } = await props.params;
  return { title: `Admin — Order ${orderNumber}` };
}

export default async function AdminOrderPage(
  props: PageProps<"/admin/orders/[orderNumber]">
) {
  const { orderNumber } = await props.params;
  const order = await getAdminOrderByNumber(orderNumber);

  if (!order) notFound();

  const saved = order.subtotal - order.total;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Link
          href="/admin/orders"
          className="w-fit text-sm text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
        >
          &larr; All orders
        </Link>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="text-xl font-semibold tabular-nums">
            {order.orderNumber}
          </h1>
          <StatusBadge status={order.status} />
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            {new Date(order.placedAt).toLocaleString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
          <div className="ml-auto">
            <OrderStatusControl orderId={order.id} status={order.status} />
          </div>
        </div>
      </div>

      {/* Items — the picking list. */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">
          Items ({order.itemCount} {order.itemCount === 1 ? "unit" : "units"} across{" "}
          {order.lines.length} {order.lines.length === 1 ? "line" : "lines"})
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[38rem] text-sm">
            <thead>
              <tr className="border-b border-black/10 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-white/10 dark:text-zinc-400">
                <th className="py-2 pr-3 font-semibold">Product</th>
                <th className="py-2 pr-3 font-semibold">Size</th>
                <th className="py-2 pr-3 font-semibold">Qty</th>
                <th className="py-2 pr-3 font-semibold">Unit price</th>
                <th className="py-2 font-semibold text-right">Line total</th>
              </tr>
            </thead>
            <tbody>
              {order.lines.map((line, index) => (
                <tr
                  key={`${line.slug}-${line.size}-${index}`}
                  className="border-b border-black/5 dark:border-white/5"
                >
                  <td className="py-3 pr-3">
                    <div className="flex items-center gap-3">
                      <ProductImage
                        image={line.image}
                        name={line.name}
                        className="h-12 w-12 flex-shrink-0 rounded"
                        sizes="48px"
                      />
                      <Link
                        href={`/products/${line.slug}`}
                        className="font-medium underline-offset-2 hover:underline"
                      >
                        {line.name}
                      </Link>
                    </div>
                  </td>
                  <td className="py-3 pr-3 font-medium">{line.size}</td>
                  <td className="py-3 pr-3 font-medium">&times; {line.quantity}</td>
                  <td className="py-3 pr-3 text-zinc-600 dark:text-zinc-400">
                    {formatPrice(line.unitPrice)}
                  </td>
                  <td className="py-3 text-right font-medium">
                    {formatPrice(line.unitPrice * line.quantity)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="ml-auto flex w-full max-w-xs flex-col gap-1 text-sm">
          {/* Only meaningful when something was discounted; place_order stores
              the list-price sum in subtotal and the charged sum in total. */}
          {saved > 0 && (
            <>
              <div className="flex justify-between text-zinc-500 dark:text-zinc-400">
                <span>Subtotal</span>
                <span>{formatPrice(order.subtotal)}</span>
              </div>
              <div className="flex justify-between font-medium text-accent">
                <span>Discount</span>
                <span>&minus;{formatPrice(saved)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between border-t border-black/10 pt-2 text-lg font-semibold dark:border-white/10">
            <span>Total</span>
            <span>{formatPrice(order.total)}</span>
          </div>
        </div>
      </section>

      <div className="grid gap-8 sm:grid-cols-2">
        {/* Everything needed to address the parcel and chase the customer. */}
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Ship to</h2>
          <address className="flex flex-col gap-1 text-sm not-italic">
            <span className="font-medium">{order.customerName}</span>
            <span className="text-zinc-600 dark:text-zinc-400">
              {order.shipTo.line1}
            </span>
            <span className="text-zinc-600 dark:text-zinc-400">
              {order.shipTo.city} &ndash; {order.shipTo.pinCode}
            </span>
          </address>
          <div className="flex flex-col gap-1 text-sm">
            <a
              href={`tel:${order.customerPhone}`}
              className="w-fit font-medium text-accent underline-offset-2 hover:underline"
            >
              {order.customerPhone}
            </a>
            {order.customerEmail && (
              <a
                href={`mailto:${order.customerEmail}`}
                className="w-fit break-all text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-400"
              >
                {order.customerEmail}
              </a>
            )}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">History</h2>
          {order.events.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No status changes recorded yet.
            </p>
          ) : (
            <ol className="flex flex-col gap-3">
              {order.events.map((event, index) => (
                <li
                  key={`${event.status}-${event.at}-${index}`}
                  className="flex flex-col gap-0.5 border-l-2 border-accent/40 pl-3 text-sm"
                >
                  <span className="font-medium">
                    {STATUS_LABELS[event.status]}
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {new Date(event.at).toLocaleString("en-IN", {
                      day: "numeric",
                      month: "short",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                    {event.note && ` · ${event.note}`}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
