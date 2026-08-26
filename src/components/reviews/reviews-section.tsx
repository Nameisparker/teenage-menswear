import { ReviewSummary } from "./review-summary";
import { ReviewForm } from "./review-form";
import { ReviewList } from "./review-list";
import type { Review } from "@/lib/types";

export function ReviewsSection({
  productId,
  reviews,
}: {
  productId: string;
  reviews: Review[];
}) {
  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-8 border-t border-black/10 px-4 py-12 sm:px-6 dark:border-white/10">
      <h2 className="text-xl font-semibold">Ratings & reviews</h2>
      <ReviewSummary reviews={reviews} />
      <ReviewForm productId={productId} />
      <ReviewList reviews={reviews} />
    </section>
  );
}
