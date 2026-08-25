/**
 * Display constants for order statuses.
 *
 * These live apart from `./orders` on purpose: that module opens a
 * cookie-bound Supabase client and so can only ever run on the server, while
 * these labels are needed by Client Components too. Importing them from here
 * keeps `next/headers` out of the client bundle.
 */
import type { OrderStatus } from "./supabase/database.types";

/** The customer-facing stages, in order. Cancelled is handled separately. */
export const TRACKING_STAGES: OrderStatus[] = [
  "pending",
  "confirmed",
  "shipped",
  "delivered",
];

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Order placed",
  confirmed: "Confirmed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};
