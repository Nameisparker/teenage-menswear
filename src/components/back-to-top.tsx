"use client";

import { useEffect, useState } from "react";

/** Far enough down that the control is useful, not so far it arrives late. */
const SHOW_AFTER_PX = 400;

/**
 * Floating "back to top" control.
 *
 * It follows the reader rather than waiting at the foot of the page: on a long
 * catalog the one moment you want it is halfway down, which is exactly where a
 * footer-anchored button cannot be reached. It stays out of the way until
 * there is something to scroll back over.
 *
 * Sits below the cart toast (z-40) so the two never fight on a narrow screen.
 */
export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > SHOW_AFTER_PX);
    // Run once: the page can be restored mid-scroll on a back navigation, and
    // waiting for a scroll event would leave the button missing until then.
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = () => {
    // Honour a reduced-motion preference the same way the landing intro does —
    // an instant jump is the accessible answer, not a slower glide.
    const reduceMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  };

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Back to top"
      // Hidden from both the pointer and the tab order while it is invisible,
      // so it cannot be clicked or focused out of nowhere.
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      className={`fixed bottom-6 right-6 z-30 flex h-12 w-12 items-center justify-center rounded-full border border-black/15 bg-white text-zinc-900 shadow-lg transition-all duration-200 hover:bg-zinc-100 dark:border-white/25 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800 ${
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-2 opacity-0"
      }`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        className="h-5 w-5"
        aria-hidden="true"
      >
        <path
          d="M12 19V5M12 5l-6 6M12 5l6 6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
