import Link from "next/link";
import { getMyOrders, STATUS_LABELS } from "@/lib/orders";
import { formatPrice } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";

export const metadata = { title: "My orders" };

export default async function OrdersPage() {
  const orders = await getMyOrders();

  if (orders.length === 0) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 py-16 sm:px-6">
        <h1 className="text-2xl font-semibold">No orders yet</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Orders you place will show up here, with tracking. If you expected to
          see something, check you are signed in with the same account.
        </p>
        <Link
          href="/products"
          className="flex h-12 items-center justify-center rounded-full bg-black px-6 font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          Start shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <h1 className="mb-8 text-2xl font-semibold">My orders</h1>

      <div className="flex flex-col gap-4">
        {orders.map((order) => (
          <Link
            key={order.id}
            href={`/orders/${order.orderNumber}`}
            className="flex flex-col gap-3 rounded-lg border border-black/10 p-5 transition-shadow hover:shadow-md dark:border-white/10 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-medium">
                  {order.orderNumber}
                </span>
                <StatusBadge status={order.status} />
              </div>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {new Date(order.placedAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
                {" · "}
                {order.lines.length}{" "}
                {order.lines.length === 1 ? "item" : "items"}
                {" · "}
                {STATUS_LABELS[order.status]}
              </span>
            </div>
            <span className="text-lg font-semibold">
              {formatPrice(order.total)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
