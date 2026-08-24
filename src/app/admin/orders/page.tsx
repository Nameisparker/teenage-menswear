import { getAllOrders } from "@/lib/admin-catalog";
import { formatPrice } from "@/lib/format";
import { OrderStatusControl } from "@/components/order-status-control";

export const metadata = { title: "Admin — Orders" };

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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Orders</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {orders.length} total. Changing a status adds an entry to the
          customer&apos;s tracking timeline.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[46rem] text-sm">
          <thead>
            <tr className="border-b border-black/10 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-white/10 dark:text-zinc-400">
              <th className="py-2 pr-3 font-semibold">Order</th>
              <th className="py-2 pr-3 font-semibold">Customer</th>
              <th className="py-2 pr-3 font-semibold">Placed</th>
              <th className="py-2 pr-3 font-semibold">Items</th>
              <th className="py-2 pr-3 font-semibold">Total</th>
              <th className="py-2 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr
                key={order.id}
                className="border-b border-black/5 dark:border-white/5"
              >
                <td className="py-3 pr-3 font-mono font-medium">
                  {order.orderNumber}
                </td>
                <td className="py-3 pr-3">
                  <div className="flex flex-col">
                    <span>{order.customerName}</span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {order.customerPhone}
                    </span>
                  </div>
                </td>
                <td className="py-3 pr-3 text-zinc-600 dark:text-zinc-400">
                  {new Date(order.placedAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </td>
                <td className="py-3 pr-3">{order.itemCount}</td>
                <td className="py-3 pr-3">{formatPrice(order.total)}</td>
                <td className="py-3">
                  <OrderStatusControl
                    orderId={order.id}
                    status={order.status}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
