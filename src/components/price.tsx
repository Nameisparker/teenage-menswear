import { formatPrice } from "@/lib/format";

/**
 * A product's price, with the list price struck through when it is on offer.
 *
 * One component for every surface — card, detail page, cart, checkout — so a
 * discounted price can never be shown one way in one place and another way
 * somewhere else.
 */
export function Price({
  price,
  offerPrice,
  discountPercent,
  quantity = 1,
  size = "base",
  showBadge = true,
  className = "",
}: {
  price: number;
  offerPrice: number;
  discountPercent: number;
  /** Multiplies both figures, for cart and checkout line totals. */
  quantity?: number;
  size?: "sm" | "base" | "lg";
  /** Off when the percentage is already shown nearby, e.g. a card image tag. */
  showBadge?: boolean;
  className?: string;
}) {
  const onOffer = discountPercent > 0 && offerPrice < price;

  const scale = {
    sm: { now: "text-sm", was: "text-xs", badge: "text-[10px]" },
    base: { now: "text-sm", was: "text-xs", badge: "text-[10px]" },
    lg: { now: "text-lg", was: "text-sm", badge: "text-xs" },
  }[size];

  if (!onOffer) {
    return (
      <span className={`${scale.now} ${className}`}>
        {formatPrice(price * quantity)}
      </span>
    );
  }

  return (
    <span className={`inline-flex flex-wrap items-baseline gap-x-2 ${className}`}>
      <span className={`${scale.now} font-semibold`}>
        {formatPrice(offerPrice * quantity)}
      </span>
      <span className={`${scale.was} text-zinc-500 line-through dark:text-zinc-400`}>
        {formatPrice(price * quantity)}
      </span>
      {showBadge && (
        <span
          className={`${scale.badge} rounded-full border border-accent/40 bg-accent/10 px-1.5 py-0.5 font-semibold uppercase tracking-wide text-accent`}
        >
          {discountPercent}% off
        </span>
      )}
    </span>
  );
}
