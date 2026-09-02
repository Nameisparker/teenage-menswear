import type { ReactNode } from "react";
import { DELIVERY_POINTS, RETURNS_POINTS } from "@/lib/policies";
import type { Product } from "@/lib/types";

/**
 * The details / delivery / returns stack under the buy button.
 *
 * Plain <details> elements, so all three work with JavaScript disabled and the
 * page needs no extra client bundle for what is essentially static copy. Only
 * the first is open on arrival: the other two are reference material, and
 * expanding them by default would push the reviews off the bottom of the page.
 */
export function ProductInfo({
  product,
  categoryLabel,
}: {
  product: Product;
  categoryLabel?: string;
}) {
  return (
    <div className="flex flex-col divide-y divide-black/10 border-y border-black/10 dark:divide-white/10 dark:border-white/10">
      <Section title="Product details" defaultOpen>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {product.description}
        </p>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          {categoryLabel && <Detail label="Category" value={categoryLabel} />}
          {product.sizes.length > 0 && (
            <Detail label="Sizes" value={product.sizes.join(", ")} />
          )}
          {/* The slug doubles as the product code — it is the stable, human
              readable identifier a customer can quote over the phone. */}
          <Detail label="Product code" value={product.slug} />
        </dl>
      </Section>

      <Section title="Delivery">
        <PointList points={DELIVERY_POINTS} />
      </Section>

      <Section title="Returns & exchange">
        <PointList points={RETURNS_POINTS} />
      </Section>
    </div>
  );
}

function Section({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group py-4">
      <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium">
        {title}
        <span
          aria-hidden="true"
          className="text-zinc-400 transition-transform group-open:rotate-45"
        >
          +
        </span>
      </summary>
      <div className="pt-3">{children}</div>
    </details>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd>{value}</dd>
    </>
  );
}

function PointList({ points }: { points: readonly string[] }) {
  return (
    <ul className="flex flex-col gap-2 text-sm text-zinc-600 dark:text-zinc-400">
      {points.map((point) => (
        <li key={point} className="flex gap-2">
          <span aria-hidden="true" className="text-accent">
            •
          </span>
          <span>{point}</span>
        </li>
      ))}
    </ul>
  );
}
