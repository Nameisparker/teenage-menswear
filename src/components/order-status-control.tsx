"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setOrderStatus } from "@/app/admin/actions";
import { STATUS_LABELS } from "@/lib/order-status";
import type { OrderStatus } from "@/lib/supabase/database.types";

const ALL_STATUSES: OrderStatus[] = [
  "pending",
  "confirmed",
  "shipped",
  "delivered",
  "cancelled",
];

/**
 * Status dropdown for one order. Writing goes through a Server Action, so the
 * "Admins update orders" policy is what actually authorises it — customers have
 * no update policy on orders at all.
 */
export function OrderStatusControl({
  orderId,
  status,
}: {
  orderId: string;
  status: OrderStatus;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleChange(next: OrderStatus) {
    if (next === status) return;
    startTransition(async () => {
      const result = await setOrderStatus(orderId, next);
      if (!result.ok) {
        setError(result.error ?? "Could not update.");
        return;
      }
      setError(null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <select
        value={status}
        disabled={pending}
        onChange={(event) => handleChange(event.target.value as OrderStatus)}
        aria-label="Order status"
        className="rounded-md border border-black/15 bg-transparent px-2 py-1.5 text-sm disabled:opacity-60 dark:border-white/20"
      >
        {ALL_STATUSES.map((option) => (
          <option key={option} value={option} className="text-black">
            {STATUS_LABELS[option]}
          </option>
        ))}
      </select>
      {error && (
        <span role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </span>
      )}
    </div>
  );
}
