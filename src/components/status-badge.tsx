import { STATUS_LABELS } from "@/lib/order-status";
import type { OrderStatus } from "@/lib/supabase/database.types";

/** Colours are tokenised per status so the badge reads the same everywhere. */
const STATUS_STYLES: Record<OrderStatus, string> = {
  pending:
    "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200",
  confirmed:
    "border-blue-500/40 bg-blue-500/10 text-blue-800 dark:text-blue-200",
  shipped:
    "border-indigo-500/40 bg-indigo-500/10 text-indigo-800 dark:text-indigo-200",
  delivered:
    "border-emerald-600/40 bg-emerald-600/10 text-emerald-800 dark:text-emerald-200",
  cancelled: "border-red-500/40 bg-red-500/10 text-red-800 dark:text-red-200",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-flex w-fit items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
