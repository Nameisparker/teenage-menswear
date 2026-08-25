"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Defers the WebGL gallery until it is close to the viewport.
 *
 * It sits several sections down the landing page, yet a static import puts ogl
 * — the whole WebGL runtime — into the bundle every visitor downloads and
 * parses before the hero is interactive. Most visitors never scroll to it.
 *
 * Two things are deferred, and they are not the same thing: `dynamic` splits
 * the code out of the initial bundle, and the IntersectionObserver below delays
 * even requesting that chunk until the section is one screen away.
 */
const CircularGallery = dynamic(
  () => import("./circular-gallery").then((m) => m.default),
  {
    // Canvas output cannot be server-rendered, and a placeholder that matches
    // the final height keeps the page from jumping when it loads.
    ssr: false,
    loading: () => <GalleryPlaceholder />,
  }
);

const GALLERY_HEIGHT = 420;

const FALLBACK_FONT = '700 22px "Segoe UI", Arial, Helvetica, sans-serif';

/**
 * The gallery draws its labels into a canvas, and canvas takes a font string,
 * not a CSS class — so it cannot inherit the page font. next/font also mangles
 * the family into a hashed name at build time, so it cannot be hardcoded
 * either. Reading the variable back off the document gives the real name.
 */
function galleryFont() {
  if (typeof window === "undefined") return FALLBACK_FONT;
  const family = getComputedStyle(document.documentElement)
    .getPropertyValue("--font-poppins")
    .trim();
  return family ? `700 22px ${family}, "Segoe UI", Arial, sans-serif` : FALLBACK_FONT;
}

function GalleryPlaceholder() {
  return <div style={{ height: GALLERY_HEIGHT }} aria-hidden="true" />;
}

export function CircularGallerySection({
  items,
}: {
  items: { image: string; text: string }[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Read once. It is a DOM read with no side effect, and the value cannot
  // change for the life of the page.
  const font = useMemo(() => galleryFont(), []);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    // No support check: IntersectionObserver has been baseline since 2019 and
    // predates every browser this project’s Tailwind v4 stylesheet targets, let
    // alone one that can run the WebGL this gates.
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      // Start fetching a screen early so it is ready by the time it is reached.
      { rootMargin: "100% 0px" }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} style={{ height: GALLERY_HEIGHT, position: "relative" }}>
      {near ? (
        /* bend={0} is a special case in the engine: it zeroes both the
            vertical arc and the per-card rotation, so products travel along a
            flat line rather than riding a curve.

            autoScrollSpeed is added to the scroll target each frame, in the
            same units as an item's width — ~0.022 at 60fps carries one product
            past roughly every two seconds. It pauses on hover, while
            dragging, when the tab is hidden, and is dropped entirely under
           prefers-reduced-motion. */
        <CircularGallery
          items={items}
          bend={0}
          textColor="#ffffff"
          borderRadius={0.06}
          scrollEase={0.03}
          autoScrollSpeed={0.022}
          font={font}
        />
      ) : (
        <GalleryPlaceholder />
      )}
    </div>
  );
}
