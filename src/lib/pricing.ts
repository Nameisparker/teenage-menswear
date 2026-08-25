/**
 * Discount arithmetic.
 *
 * This mirrors the products.offer_price generated column in
 * supabase/migrations/20260825000000_product_discounts.sql. Nothing charges a
 * customer from this function — the database does that — but the admin screen
 * needs to preview an offer price before it has been saved, and the preview
 * must match what the database will produce. Change one, change the other.
 */
export function offerPriceFor(price: number, discountPercent: number): number {
  if (discountPercent <= 0) return price;
  return Math.max(Math.round((price * (100 - discountPercent)) / 100), 1);
}

/** Largest discount an admin may set, matching the column's check constraint. */
export const MAX_DISCOUNT_PERCENT = 90;
