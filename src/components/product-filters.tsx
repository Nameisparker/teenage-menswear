"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  DEFAULT_SORT,
  SORT_OPTIONS,
  hasActiveFilters,
  type ProductQuery,
  type SortValue,
} from "@/lib/product-filters";

/**
 * Sort and filter controls for /products.
 *
 * Every control writes to the URL and lets the server component re-render the
 * grid, so a filtered view can be shared, bookmarked, and walked back through
 * with the browser's back button.
 *
 * The current query string arrives as a prop rather than through
 * useSearchParams() on purpose: the page already has it, and reading it here
 * would drag this component (and therefore the whole listing) behind a Suspense
 * boundary to keep the production build from failing on the prerender.
 */
export function ProductFilters({
  search,
  sizes,
  query,
  resultCount,
}: {
  /** The page's current query string, without the leading "?". */
  search: string;
  /** Sizes offered by the products in the current category. */
  sizes: string[];
  query: ProductQuery;
  resultCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Price is the one control that should not navigate on every keystroke, so
  // it keeps local state and commits on submit or blur.
  const [minPrice, setMinPrice] = useState(query.minPrice?.toString() ?? "");
  const [maxPrice, setMaxPrice] = useState(query.maxPrice?.toString() ?? "");

  // Re-sync while rendering when the URL changes underneath us — a back/forward
  // navigation or "Clear filters" would otherwise leave stale numbers sitting
  // in the boxes. React's documented way to adjust state on a prop change; an
  // effect here would render once with the stale value before correcting it.
  const urlPrice = `${query.minPrice ?? ""}-${query.maxPrice ?? ""}`;
  const [lastUrlPrice, setLastUrlPrice] = useState(urlPrice);
  if (urlPrice !== lastUrlPrice) {
    setLastUrlPrice(urlPrice);
    setMinPrice(query.minPrice?.toString() ?? "");
    setMaxPrice(query.maxPrice?.toString() ?? "");
  }

  function navigate(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(search);
    mutate(params);
    const next = params.toString();
    startTransition(() => {
      router.replace(next ? `/products?${next}` : "/products", {
        scroll: false,
      });
    });
  }

  function setParam(params: URLSearchParams, key: string, value: string) {
    if (value) params.set(key, value);
    else params.delete(key);
  }

  function toggleSize(size: string) {
    navigate((params) => {
      const next = query.sizes.includes(size)
        ? query.sizes.filter((s) => s !== size)
        : [...query.sizes, size];
      setParam(params, "size", next.join(","));
    });
  }

  function commitPrice() {
    // Swap reversed bounds instead of returning nothing — someone who types
    // 2000 and 500 meant a range, not an empty grid.
    const min = minPrice.trim();
    const max = maxPrice.trim();
    const swap = min && max && Number(min) > Number(max);
    navigate((params) => {
      setParam(params, "min", swap ? max : min);
      setParam(params, "max", swap ? min : max);
    });
  }

  const active = hasActiveFilters(query);

  return (
    <div
      className={`mt-6 mb-8 flex flex-col gap-4 border-y border-black/10 py-4 dark:border-white/10 ${
        pending ? "opacity-60" : ""
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {resultCount} {resultCount === 1 ? "product" : "products"}
        </p>

        <label className="flex items-center gap-2 text-sm">
          <span className="text-zinc-500 dark:text-zinc-400">Sort by</span>
          <select
            value={query.sort}
            onChange={(event) => {
              const value = event.target.value as SortValue;
              navigate((params) => {
                setParam(params, "sort", value === DEFAULT_SORT ? "" : value);
              });
            }}
            className="rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/20"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        {sizes.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              Size
            </span>
            {sizes.map((size) => {
              // The query holds uppercased keys; the chip shows the label as
              // the catalog spells it.
              const key = size.toUpperCase();
              const selected = query.sizes.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleSize(key)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    selected
                      ? "border-accent bg-accent text-accent-foreground"
                      : "border-black/15 hover:border-black/40 dark:border-white/20 dark:hover:border-white/50"
                  }`}
                >
                  {size}
                </button>
              );
            })}
          </div>
        )}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            commitPrice();
          }}
          className="flex items-center gap-2"
        >
          <span className="text-sm text-zinc-500 dark:text-zinc-400">Price</span>
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={minPrice}
            onChange={(event) => setMinPrice(event.target.value)}
            onBlur={commitPrice}
            placeholder="Min"
            aria-label="Minimum price"
            className="w-20 rounded-md border border-black/15 bg-transparent px-2 py-1.5 text-sm dark:border-white/20"
          />
          <span className="text-sm text-zinc-500 dark:text-zinc-400">–</span>
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={maxPrice}
            onChange={(event) => setMaxPrice(event.target.value)}
            onBlur={commitPrice}
            placeholder="Max"
            aria-label="Maximum price"
            className="w-20 rounded-md border border-black/15 bg-transparent px-2 py-1.5 text-sm dark:border-white/20"
          />
          {/* Submit exists for the Enter key; blur already commits, so it has
              nothing to add visually. */}
          <button type="submit" className="sr-only">
            Apply price range
          </button>
        </form>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={query.onSale}
            onChange={(event) => {
              const checked = event.target.checked;
              navigate((params) => {
                setParam(params, "sale", checked ? "1" : "");
              });
            }}
            className="h-4 w-4 accent-accent"
          />
          On sale only
        </label>

        {active && (
          <button
            type="button"
            onClick={() =>
              navigate((params) => {
                for (const key of ["size", "min", "max", "sale"]) {
                  params.delete(key);
                }
              })
            }
            className="text-sm font-medium text-accent underline-offset-2 hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
