"use server";

import { getProductBySlug } from "@/lib/catalog";
import type { Product } from "@/lib/types";

/**
 * Full product for the quick view, fetched when the modal opens.
 *
 * A listing deliberately does not select the extra angles — four more rows per
 * product for a grid that shows one photo each — so `product.images` there is
 * just the cover. Quick view wants the whole gallery, and asking for it only
 * when someone opens one keeps that cost off the listing.
 */
export async function fetchQuickView(slug: string): Promise<Product | null> {
  const product = await getProductBySlug(slug);
  return product ?? null;
}
