"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * "Back" for the whole app, under the header.
 *
 * Hidden on the home page, which has nowhere to go back to within the store.
 */
export function BackButton() {
  const router = useRouter();
  const pathname = usePathname();

  /**
   * Whether this visit has moved between pages yet.
   *
   * router.back() is only the right answer when the previous entry is one of
   * ours. Someone who opened a product link straight from a search result has
   * the search result behind them, and "Back" throwing them off the store is
   * not what the button appears to promise. Counted here because the layout
   * keeps this component mounted across navigations.
   */
  const navigated = useRef(false);
  const firstPath = useRef(pathname);
  useEffect(() => {
    // Cleared again on the way back: arriving at the page this visit started
    // on means there is nothing of ours behind it any more. Leaving the flag
    // set would send the next Back off the store — the very thing it guards.
    navigated.current = pathname !== firstPath.current;
  }, [pathname]);

  if (pathname === "/") return null;

  const goBack = () => {
    if (navigated.current) router.back();
    // Nowhere of ours to return to, so offer the obvious destination instead.
    else router.push("/");
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6">
      <button
        type="button"
        onClick={goBack}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-600 transition-colors hover:text-black dark:text-zinc-400 dark:hover:text-white"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          className="h-4 w-4"
          aria-hidden="true"
        >
          <path
            d="M15 19l-7-7 7-7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Back
      </button>
    </div>
  );
}
