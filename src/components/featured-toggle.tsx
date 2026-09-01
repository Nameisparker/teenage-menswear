"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setProductFeatured } from "@/app/admin/actions";

/**
 * Adds or removes one product from the featured list.
 *
 * Optimism would be wrong here: the home page is the thing being edited, and
 * the list this button sits in is re-read after the write, so it waits for the
 * server rather than showing a state the database might not agree with.
 */
export function FeaturedToggle({
  productId,
  name,
  featured,
}: {
  productId: string;
  name: string;
  featured: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      const result = await setProductFeatured(productId, !featured);
      if (!result.ok) {
        setError(result.error ?? "Could not save.");
        return;
      }
      setError(null);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-end gap-3">
      {error && (
        <span role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </span>
      )}
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-label={
          featured ? `Remove ${name} from featured` : `Feature ${name}`
        }
        className={
          featured
            ? "h-8 rounded-full border border-black/15 px-3 text-xs font-medium transition-colors hover:border-black/40 disabled:opacity-40 dark:border-white/20 dark:hover:border-white/50"
            : "h-8 rounded-full bg-accent px-3 text-xs font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
        }
      >
        {pending ? "Saving…" : featured ? "Remove" : "Feature"}
      </button>
    </div>
  );
}
