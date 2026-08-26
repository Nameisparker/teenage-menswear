import { StarRatingDisplay } from "./star-rating";
import type { Review } from "@/lib/types";

/**
 * Average + per-star breakdown bars, à la Amazon/Flipkart.
 *
 * Computed from the already-fetched review list rather than a separate
 * aggregate query — fine at this store's review volume, and it means the
 * count shown here can never drift from the list rendered below it.
 */
export function ReviewSummary({ reviews }: { reviews: Review[] }) {
  const count = reviews.length;

  if (count === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        No reviews yet — be the first to review this product.
      </p>
    );
  }

  const average = reviews.reduce((sum, r) => sum + r.rating, 0) / count;
  const counts = [5, 4, 3, 2, 1].map((star) => ({
    star,
    n: reviews.filter((r) => r.rating === star).length,
  }));

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-8">
      <div className="flex flex-col items-start gap-1">
        <span className="text-3xl font-semibold">{average.toFixed(1)}</span>
        <StarRatingDisplay value={average} />
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          {count} review{count === 1 ? "" : "s"}
        </span>
      </div>

      <div className="flex w-full max-w-xs flex-col gap-1">
        {counts.map(({ star, n }) => (
          <div key={star} className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="w-3 text-right">{star}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${count ? (n / count) * 100 : 0}%` }}
              />
            </div>
            <span className="w-6">{n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
