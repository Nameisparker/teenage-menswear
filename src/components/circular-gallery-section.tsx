"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

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

function GalleryPlaceholder() {
  return <div style={{ height: GALLERY_HEIGHT }} aria-hidden="true" />;
}

export function CircularGallerySection({
  items,
}: {
  items: { image: string; text: string }[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
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
        <CircularGallery
          items={items}
          bend={2}
          textColor="#ffffff"
          borderRadius={0.06}
          scrollEase={0.03}
          font="700 22px Arial, Helvetica, sans-serif"
        />
      ) : (
        <GalleryPlaceholder />
      )}
    </div>
  );
}
