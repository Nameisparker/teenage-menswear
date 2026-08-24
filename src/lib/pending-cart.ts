import type { Product } from "./types";

const KEY = "clothing-store-pending-cart-add";

/**
 * Google sign-in leaves the page, so the "add this item" intent cannot live in
 * React state. Park it in sessionStorage and replay it once the user is back
 * and authenticated.
 */
export type PendingCartAdd = {
  product: Product;
  size: string;
  quantity: number;
  savedAt: number;
};

/** Long enough for an OAuth round trip, short enough that a stale intent from
 * an abandoned sign-in never silently adds an item on a later visit. */
const MAX_AGE_MS = 10 * 60 * 1000;

export function savePendingCartAdd(
  product: Product,
  size: string,
  quantity = 1
) {
  try {
    const pending: PendingCartAdd = {
      product,
      size,
      quantity,
      savedAt: Date.now(),
    };
    window.sessionStorage.setItem(KEY, JSON.stringify(pending));
  } catch {
    // Private mode / storage disabled — the user just re-clicks Add to cart.
  }
}

/** Reads and removes the intent. Returns null when absent, stale or corrupt. */
export function takePendingCartAdd(): PendingCartAdd | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(KEY);

    const pending = JSON.parse(raw) as PendingCartAdd;
    if (!pending?.product?.slug || !pending.size) return null;
    if (Date.now() - pending.savedAt > MAX_AGE_MS) return null;
    return pending;
  } catch {
    return null;
  }
}

export function clearPendingCartAdd() {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
