import { StarRatingDisplay } from "./star-rating";
import type { Review } from "@/lib/types";

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function ReviewList({ reviews }: { reviews: Review[] }) {
  if (reviews.length === 0) return null;

  return (
    <ul className="flex flex-col gap-6">
      {reviews.map((review) => (
        <li key={review.id} className="flex flex-col gap-1.5 border-t border-black/10 pt-6 dark:border-white/10">
          <div className="flex items-center gap-3">
            <StarRatingDisplay value={review.rating} size="sm" />
            <span className="text-sm font-medium">{review.reviewerName}</span>
          </div>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {dateFormatter.format(new Date(review.createdAt))}
            {review.updatedAt !== review.createdAt && " (edited)"}
          </span>
          {review.comment && (
            <p className="text-sm text-zinc-700 dark:text-zinc-300">{review.comment}</p>
          )}
        </li>
      ))}
    </ul>
  );
}
