"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BACK_BAR_ID } from "@/lib/back-bar";

/**
 * "Back" for the whole app, under the header.
 *
 * Rendered on every route, including the home page, and hidden there by a rule
 * the home page serves itself — see the hide rule in app/page.tsx.
 *
 * It reads better as `if (pathname === "/") return null`, which is what this
 * used to do, and it is wrong: usePathname() is a client hook, so on the server
 * its value comes from the route being rendered, and a project with a Proxy
 * file (ours gates /admin, /orders and /account) cannot rely on that matching
 * the browser pathname. next/dist/docs/01-app/03-api-reference/04-functions/
 * use-pathname.md calls this out directly. In production the prerendered home
 * page came back with a pathname that was not "/", so the server shipped this
 * button and the client removed it — a hydration mismatch that left a Back
 * button sitting on the home page and, after a navigation, an orphaned second
 * copy on top of the real one elsewhere. Neither reproduced in `next dev` or in
 * a local `next build`, which is what makes it worth this much comment.
 *
 * So the markup is now identical on every route and one CSS rule decides. The
 * pathname is still read below, but only for the click target, which runs well
 * after hydration.
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

  const goBack = () => {
    if (navigated.current) router.back();
    // Nowhere of ours to return to, so offer the obvious destination instead.
    else router.push("/");
  };

  return (
    <div
      id={BACK_BAR_ID}
      className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6"
    >
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
