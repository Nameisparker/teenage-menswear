const SIZE_CLASS = {
  sm: "h-3.5 w-3.5",
  base: "h-4 w-4",
  lg: "h-6 w-6",
} as const;

function Star({ fill, className }: { fill: number; className: string }) {
  // Two stacked outlines: a grey one for the empty state, and an accent one
  // clipped to `fill` (0-1) so partial values (e.g. a 4.3 average) render a
  // partly-filled star instead of rounding to a whole one.
  return (
    <span className={`relative inline-block ${className}`}>
      <svg viewBox="0 0 20 20" fill="currentColor" className="absolute inset-0 text-zinc-300 dark:text-zinc-700">
        <path d="M10 1.6l2.6 5.4 5.9.8-4.3 4.1 1 5.9L10 14.9l-5.2 2.9 1-5.9-4.3-4.1 5.9-.8L10 1.6z" />
      </svg>
      <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-full w-full text-accent">
          <path d="M10 1.6l2.6 5.4 5.9.8-4.3 4.1 1 5.9L10 14.9l-5.2 2.9 1-5.9-4.3-4.1 5.9-.8L10 1.6z" />
        </svg>
      </span>
    </span>
  );
}

/** Read-only stars, supporting fractional values for an average rating. */
export function StarRatingDisplay({
  value,
  size = "base",
  className = "",
}: {
  value: number;
  size?: "sm" | "base" | "lg";
  className?: string;
}) {
  const sizeClass = SIZE_CLASS[size];
  return (
    <span
      className={`inline-flex items-center gap-0.5 ${className}`}
      role="img"
      aria-label={`Rated ${value.toFixed(1)} out of 5`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} fill={Math.max(0, Math.min(1, value - (i - 1)))} className={sizeClass} />
      ))}
    </span>
  );
}

/** Clickable whole-star input, for the review form. */
export function StarRatingInput({
  value,
  onChange,
  size = "lg",
}: {
  value: number;
  onChange: (next: number) => void;
  size?: "sm" | "base" | "lg";
}) {
  const sizeClass = SIZE_CLASS[size];
  return (
    <span className="inline-flex items-center gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={value === i}
          aria-label={`${i} star${i === 1 ? "" : "s"}`}
          onClick={() => onChange(i)}
          className="p-0.5 transition-transform hover:scale-110"
        >
          <Star fill={i <= value ? 1 : 0} className={sizeClass} />
        </button>
      ))}
    </span>
  );
}
