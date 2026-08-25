"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Catches render errors inside the layout — a failed catalog query, mostly.
 *
 * The catalog helpers throw rather than returning empty, so a Supabase blip
 * takes a page down. Without this file Next serves its own bare error screen;
 * with it the visitor gets the store's chrome, an explanation, and a way out.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Server-side causes are already logged with this digest; logging here ties
    // the visitor's report ("it said abc123") to that entry.
    console.error("Page error", error.digest, error.message);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="max-w-md text-zinc-500 dark:text-zinc-400">
        We couldn&apos;t load this page. It is usually temporary — try again in
        a moment.
      </p>
      {error.digest && (
        <p className="text-xs text-zinc-400">
          Reference: {error.digest}
        </p>
      )}
      <div className="flex flex-wrap gap-3 pt-2">
        <button
          type="button"
          onClick={reset}
          className="flex h-12 items-center justify-center rounded-full bg-accent px-6 font-medium text-accent-foreground transition-opacity hover:opacity-90"
        >
          Try again
        </button>
        <Link
          href="/"
          className="flex h-12 items-center justify-center rounded-full border border-black/15 px-6 font-medium transition-colors hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
