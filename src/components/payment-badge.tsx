import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
} from "@/lib/payment";
import type { PaymentMethod, PaymentStatus } from "@/lib/supabase/database.types";

/**
 * How an order was paid for, at a glance.
 *
 * Method and status are shown together because neither means much alone: an
 * unpaid COD order is the normal state of a new order, while an unpaid prepaid
 * order is an abandoned payment that nobody should be packing.
 */
export function PaymentBadge({
  method,
  status,
}: {
  method: PaymentMethod;
  status: PaymentStatus;
}) {
  const awaitingPrepayment = method === "razorpay" && status !== "paid";

  const tone =
    status === "paid"
      ? "border-emerald-600/40 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400"
      : awaitingPrepayment || status === "failed"
        ? "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400"
        : "border-black/15 text-zinc-600 dark:border-white/20 dark:text-zinc-400";

  const label =
    status === "paid"
      ? method === "cod"
        ? "COD · Paid"
        : "Paid online"
      : method === "cod"
        ? "COD · Pay on delivery"
        : PAYMENT_STATUS_LABELS[status] === "Unpaid"
          ? "Online · Not paid"
          : PAYMENT_STATUS_LABELS[status];

  return (
    <span
      title={`${PAYMENT_METHOD_LABELS[method]} — ${PAYMENT_STATUS_LABELS[status]}`}
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${tone}`}
    >
      {label}
    </span>
  );
}
