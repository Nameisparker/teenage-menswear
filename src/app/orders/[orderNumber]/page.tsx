import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getOrderByNumber,
  STATUS_LABELS,
  TRACKING_STAGES,
} from "@/lib/orders";
import { formatPrice } from "@/lib/format";
import { ProductImage } from "@/components/product-image";
import { StatusBadge } from "@/components/status-badge";

export async function generateMetadata(
  props: PageProps<"/orders/[orderNumber]">
) {
  const { orderNumber } = await props.params;
  return { title: `Order ${orderNumber}` };
}

export default async function OrderTrackingPage(
  props: PageProps<"/orders/[orderNumber]">
) {
  const { orderNumber } = await props.params;
  const order = await getOrderByNumber(orderNumber);

  // RLS returns nothing for someone else's order, so this covers both "no such
  // order" and "not yours" — deliberately indistinguishable.
  if (!order) notFound();

  const cancelled = order.status === "cancelled";
  const reachedIndex = TRACKING_STAGES.indexOf(order.status);

  /** When each stage happened, from the event log. */
  const stageTimes = new Map(
    order.events.map((event) => [event.status, event.at])
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <Link
        href="/orders"
        className="text-sm text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
      >
        &larr; All orders
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="font-mono text-2xl font-semibold">
            {order.orderNumber}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Placed{" "}
            {new Date(order.placedAt).toLocaleString("en-IN", {
              day: "numeric",
              month: "long",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      {/* Tracking */}
      <section className="mt-10">
        <h2 className="mb-6 text-lg font-semibold">Tracking</h2>

        {cancelled ? (
          <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-800 dark:text-red-200">
            This order was cancelled. Call the store if that looks wrong.
          </p>
        ) : (
          <ol className="flex flex-col gap-0 sm:flex-row sm:gap-0">
            {TRACKING_STAGES.map((stage, index) => {
              const done = index <= reachedIndex;
              const at = stageTimes.get(stage);
              return (
                <li
                  key={stage}
                  className="flex flex-1 gap-4 sm:flex-col sm:gap-3"
                >
                  {/* Connector + dot */}
                  <div className="flex flex-col items-center sm:w-full sm:flex-row">
                    <span
                      aria-hidden="true"
                      className={`hidden h-0.5 flex-1 sm:block ${
                        index === 0
                          ? "bg-transparent"
                          : done
                            ? "bg-accent"
                            : "bg-black/15 dark:bg-white/20"
                      }`}
                    />
                    <span
                      className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${
                        done
                          ? "border-accent bg-accent text-accent-foreground"
                          : "border-black/20 text-zinc-400 dark:border-white/25"
                      }`}
                    >
                      {done ? "✓" : index + 1}
                    </span>
                    <span
                      aria-hidden="true"
                      className={`hidden h-0.5 flex-1 sm:block ${
                        index === TRACKING_STAGES.length - 1
                          ? "bg-transparent"
                          : index < reachedIndex
                            ? "bg-accent"
                            : "bg-black/15 dark:bg-white/20"
                      }`}
                    />
                    {/* Vertical connector on mobile */}
                    {index < TRACKING_STAGES.length - 1 && (
                      <span
                        aria-hidden="true"
                        className={`w-0.5 flex-1 sm:hidden ${
                          index < reachedIndex
                            ? "bg-accent"
                            : "bg-black/15 dark:bg-white/20"
                        }`}
                      />
                    )}
                  </div>

                  <div className="pb-6 sm:pb-0 sm:text-center">
                    <p
                      className={`text-sm font-medium ${
                        done ? "" : "text-zinc-400 dark:text-zinc-500"
                      }`}
                    >
                      {STATUS_LABELS[stage]}
                    </p>
                    {at && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {new Date(at).toLocaleString("en-IN", {
                          day: "numeric",
                          month: "short",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <div className="mt-10 grid gap-10 sm:grid-cols-2">
        {/* Items */}
        <section>
          <h2 className="mb-4 text-lg font-semibold">Items</h2>
          <div className="flex flex-col gap-4">
            {order.lines.map((line, index) => (
              <div key={`${line.slug}-${line.size}-${index}`} className="flex gap-4">
                <ProductImage
                  image={line.image}
                  name={line.name}
                  className="h-20 w-20 flex-shrink-0 rounded-md"
                  sizes="80px"
                />
                <div className="flex flex-1 flex-col justify-center gap-1">
                  <Link
                    href={`/products/${line.slug}`}
                    className="font-medium hover:underline"
                  >
                    {line.name}
                  </Link>
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    Size {line.size} &middot; Qty {line.quantity}
                  </span>
                </div>
                <span className="self-center font-medium">
                  {formatPrice(line.unitPrice * line.quantity)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-6 flex justify-between border-t border-black/10 pt-4 text-lg font-semibold dark:border-white/10">
            <span>Total</span>
            <span>{formatPrice(order.total)}</span>
          </div>
        </section>

        {/* Delivery */}
        <section>
          <h2 className="mb-4 text-lg font-semibold">Delivering to</h2>
          <address className="flex flex-col gap-1 text-sm not-italic text-zinc-600 dark:text-zinc-400">
            <span className="font-medium text-foreground">
              {order.shipTo.fullName}
            </span>
            <span>{order.shipTo.line1}</span>
            <span>
              {order.shipTo.city} &ndash; {order.shipTo.pinCode}
            </span>
            <span className="mt-2">{order.shipTo.phone}</span>
          </address>

          <h2 className="mb-3 mt-8 text-lg font-semibold">History</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {order.events.map((event, index) => (
              <li key={index} className="flex justify-between gap-4">
                <span>{event.note ?? STATUS_LABELS[event.status]}</span>
                <span className="flex-shrink-0 text-zinc-500 dark:text-zinc-400">
                  {new Date(event.at).toLocaleString("en-IN", {
                    day: "numeric",
                    month: "short",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
