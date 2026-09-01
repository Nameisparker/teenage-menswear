/**
 * Sort and filter rules for the products listing.
 *
 * Kept out of the page and the filter UI because both need them: the server
 * component applies them to the fetched rows, and the client control reads the
 * same option lists to render the choices. Everything is derived from the URL,
 * so a filtered listing stays shareable, bookmarkable, and back-button-safe.
 *
 * The filtering runs in memory rather than in Postgres. A size filter is a
 * predicate over the joined variants, which PostgREST cannot express without
 * either dropping products that have a non-matching variant or a second
 * round-trip — and the catalog is a single store's worth of products, already
 * fetched in full for the category chips.
 */
import type { Product } from "./types";

export type SortValue =
  | "featured"
  | "price-asc"
  | "price-desc"
  | "discount"
  | "name-asc";

export const SORT_OPTIONS: { value: SortValue; label: string }[] = [
  { value: "featured", label: "Featured" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "discount", label: "Biggest discount" },
  { value: "name-asc", label: "Name: A–Z" },
];

export const DEFAULT_SORT: SortValue = "featured";

export type ProductQuery = {
  sort: SortValue;
  /** Uppercased size labels. Empty means "any size". */
  sizes: string[];
  minPrice?: number;
  maxPrice?: number;
  onSale: boolean;
};

/** What Next hands us for a single search param. */
type Param = string | string[] | undefined;

function first(value: Param): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseMoney(value: Param): number | undefined {
  const raw = first(value);
  if (!raw) return undefined;
  const amount = Number(raw);
  // Reject NaN and negatives outright — a bad value should behave like no
  // filter at all rather than silently emptying the grid.
  return Number.isFinite(amount) && amount >= 0 ? amount : undefined;
}

/**
 * Accepts both `?size=M&size=L` and `?size=M,L`. The first is what a plain
 * multi-checkbox form produces, the second is what our own links write, and a
 * hand-edited URL could be either.
 */
function parseSizes(value: Param): string[] {
  const raw = Array.isArray(value) ? value : value ? [value] : [];
  const seen = new Set<string>();
  for (const entry of raw) {
    for (const size of entry.split(",")) {
      const trimmed = size.trim().toUpperCase();
      if (trimmed) seen.add(trimmed);
    }
  }
  return [...seen];
}

export function parseProductQuery(
  params: Record<string, Param>
): ProductQuery {
  const sort = first(params.sort);
  return {
    sort: SORT_OPTIONS.some((option) => option.value === sort)
      ? (sort as SortValue)
      : DEFAULT_SORT,
    sizes: parseSizes(params.size),
    minPrice: parseMoney(params.min),
    maxPrice: parseMoney(params.max),
    onSale: first(params.sale) === "1",
  };
}

/** True when anything other than the default sort is in effect. */
export function hasActiveFilters(query: ProductQuery): boolean {
  return (
    query.sizes.length > 0 ||
    query.minPrice !== undefined ||
    query.maxPrice !== undefined ||
    query.onSale
  );
}

// Letter sizes first in the order a rack uses, then anything numeric (waist
// sizes) ascending, then the rest alphabetically. Sizes are per-product data,
// so no single sort_order spans the catalog.
const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL"];

export function compareSizes(a: string, b: string): number {
  const indexA = SIZE_ORDER.indexOf(a.toUpperCase());
  const indexB = SIZE_ORDER.indexOf(b.toUpperCase());
  if (indexA !== -1 || indexB !== -1) {
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  }
  const numberA = Number(a);
  const numberB = Number(b);
  if (Number.isFinite(numberA) && Number.isFinite(numberB)) {
    return numberA - numberB;
  }
  return a.localeCompare(b);
}

/**
 * Every size offered across the given products, in rack order.
 *
 * Deduped case-insensitively but returned in the label's own casing, so a chip
 * reads "One Size" rather than shouting "ONE SIZE". Callers match against the
 * query with toUpperCase().
 */
export function availableSizes(products: Product[]): string[] {
  const labels = new Map<string, string>();
  for (const product of products) {
    for (const size of product.sizes) {
      const key = size.toUpperCase();
      if (!labels.has(key)) labels.set(key, size);
    }
  }
  return [...labels.values()].sort(compareSizes);
}

const COMPARATORS: Record<SortValue, (a: Product, b: Product) => number> = {
  // Featured first, then alphabetical — without the tiebreaker the order of
  // everything below the featured block would depend on the fetch order.
  featured: (a, b) =>
    Number(Boolean(b.featured)) - Number(Boolean(a.featured)) ||
    a.name.localeCompare(b.name),
  // Sorting on what the customer actually pays, not the struck-through price.
  "price-asc": (a, b) => a.offerPrice - b.offerPrice || a.name.localeCompare(b.name),
  "price-desc": (a, b) => b.offerPrice - a.offerPrice || a.name.localeCompare(b.name),
  discount: (a, b) =>
    b.discountPercent - a.discountPercent || a.name.localeCompare(b.name),
  "name-asc": (a, b) => a.name.localeCompare(b.name),
};

/** Filters, then sorts. Never mutates the input array. */
export function applyProductQuery(
  products: Product[],
  query: ProductQuery
): Product[] {
  const wanted = new Set(query.sizes);

  const filtered = products.filter((product) => {
    if (query.onSale && product.discountPercent <= 0) return false;
    if (query.minPrice !== undefined && product.offerPrice < query.minPrice) {
      return false;
    }
    if (query.maxPrice !== undefined && product.offerPrice > query.maxPrice) {
      return false;
    }
    // A product matches if it stocks *any* of the requested sizes.
    if (wanted.size > 0) {
      return product.sizes.some((size) => wanted.has(size.toUpperCase()));
    }
    return true;
  });

  return filtered.sort(COMPARATORS[query.sort]);
}
