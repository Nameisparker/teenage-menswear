"use client";

import { useState } from "react";
import { ProductImage } from "@/components/product-image";

/**
 * The product's images, one large and the rest as thumbnails.
 *
 * A client component only because picking a thumbnail is state. With a single
 * image it renders exactly what the page rendered before — no strip, no
 * wrapper, nothing to explain.
 *
 * Buttons rather than a scroller with dots: on a product page the shopper is
 * comparing specific angles, and a control they can tab to and see the whole
 * set of beats a carousel that hides two of the four.
 */
export function ProductGallery({
  images,
  name,
}: {
  images: string[];
  name: string;
}) {
  const [active, setActive] = useState(0);
  // Guards a gallery whose rows changed under a cached page: an index past the
  // end would render a broken main image.
  const shown = images[active] ?? images[0] ?? "";

  if (images.length <= 1) {
    return (
      <ProductImage
        image={shown}
        name={name}
        className="aspect-square w-full rounded-lg"
        sizes="(min-width: 640px) 50vw, 100vw"
        priority
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ProductImage
        image={shown}
        name={name}
        className="aspect-square w-full rounded-lg"
        sizes="(min-width: 640px) 50vw, 100vw"
        priority
      />

      <ul className="flex flex-wrap gap-2">
        {images.map((image, index) => (
          <li key={`${image}-${index}`}>
            <button
              type="button"
              onClick={() => setActive(index)}
              aria-label={`${name} — image ${index + 1} of ${images.length}`}
              aria-current={index === active ? "true" : undefined}
              className={`overflow-hidden rounded-md border transition-colors ${
                index === active
                  ? "border-black dark:border-white"
                  : "border-black/10 hover:border-black/40 dark:border-white/15 dark:hover:border-white/50"
              }`}
            >
              <ProductImage
                image={image}
                name=""
                className="h-16 w-16"
                sizes="64px"
              />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
