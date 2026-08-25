import Link from "next/link";
import { getAllOrders } from "@/lib/admin-catalog";
import { formatPrice } from "@/lib/format";
import { ProductImage } from "@/components/product-image";
import { OrderStatusControl } from "@/components/order-status-control";

export const metadata = { title: "Admin — Orders" };

/** Beyond this, the row lists a count instead of every thumbnail. */
const PREVIEW_LIMIT = 4;

export default async function AdminOrdersPage() {
  const orders = await getAllOrders();

  if (orders.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">Orders</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No orders yet. They appear here the moment a customer checks out.
        </p>
      </div>
    );
  }

  const open = orders.filter(
    (order) => order.status === "pending" || order.status === "confirmed"
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Orders</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {orders.length} total
          {open.length > 0 && ` · ${open.length} awaiting dispatch`}. Changing a
          status adds an entry to the customer&apos;s tracking timeline.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {orders.map((order) => {
          const shown = order.lines.slice(0, PREVIEW_LIMIT);
          const hidden = order.lines.length - shown.length;

          return (
            <div
              key={order.id}
              className="flex flex-col gap-4 rounded-lg border border-black/10 p-4 dark:border-white/10"
            >
              <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                <div className="flex flex-col gap-1">
                  <Link
                    href={`/admin/orders/${order.orderNumber}`}
                    className="font-medium tabular-nums underline-offset-2 hover:underline"
                  >
                    {order.orderNumber}
                  </Link>
                  <span className="text-sm">{order.customerName}</span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {order.customerPhone}
                    {" · "}
                    {new Date(order.placedAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>

                <div className="flex items-center gap-6">
                  <div className="flex flex-col items-end">
                    <span className="text-lg font-semibold">
                      {formatPrice(order.total)}
                    </span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {order.itemCount}{" "}
                      {order.itemCount === 1 ? "unit" : "units"}
                    </span>
                  </div>
                  <OrderStatusControl
                    orderId={order.id}
                    status={order.status}
                  />
                </div>
              </div>

              {/* The picking summary. Without it a row says an order exists but
                  not what to put in the box, which is the actual question. */}
              <div className="flex flex-wrap items-center gap-3 border-t border-black/5 pt-3 dark:border-white/5">
                {shown.map((line, index) => (
                  <div
                    key={`${line.slug}-${line.size}-${index}`}
                    className="flex items-center gap-2"
                  >
                    <ProductImage
                      image={line.image}
                      name={line.name}
                      className="h-10 w-10 flex-shrink-0 rounded"
                      sizes="40px"
                    />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{line.name}</span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        Size {line.size} &middot; &times;{line.quantity}
                      </span>
                    </div>
                  </div>
                ))}
                {hidden > 0 && (
                  <Link
                    href={`/admin/orders/${order.orderNumber}`}
                    className="text-sm font-medium text-accent underline-offset-2 hover:underline"
                  >
                    +{hidden} more
                  </Link>
                )}
                <Link
                  href={`/admin/orders/${order.orderNumber}`}
                  className="ml-auto text-sm font-medium text-accent underline-offset-2 hover:underline"
                >
                  Full order &rarr;
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
