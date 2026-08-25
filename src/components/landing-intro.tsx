"use client";

import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import ParticleText from "./particle-text";

const GATHER_DURATION = 1400;
const STAGGER = 350;
const HOLD_MS = 300;
const CROSSFADE_MS = 700;
const REVEAL_AT_MS = GATHER_DURATION + STAGGER + HOLD_MS;

/**
 * Reduced motion, read through useSyncExternalStore rather than corrected in an
 * effect. A lazy useState initialiser cannot be used here: the server has no
 * matchMedia, so it would hydrate against a different value. This hook exists
 * for exactly that — it renders the server snapshot, then re-renders with the
 * real one, with no mismatch and no setState from an effect.
 */
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(onChange: () => void) {
  const query = window.matchMedia?.(REDUCED_MOTION_QUERY);
  query?.addEventListener("change", onChange);
  return () => query?.removeEventListener("change", onChange);
}

const getReducedMotion = () =>
  window.matchMedia?.(REDUCED_MOTION_QUERY).matches ?? false;

// The server cannot know; assume motion is welcome and correct on hydration.
const getReducedMotionOnServer = () => false;

export function LandingIntro({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const prefersReducedMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotion,
    getReducedMotionOnServer
  );

  const [timerRevealed, setTimerRevealed] = useState(false);
  const [overlayMounted, setOverlayMounted] = useState(true);

  // Someone who asked for no motion skips straight to the revealed state, so
  // the intro never has to be torn down after the fact.
  const revealed = prefersReducedMotion || timerRevealed;
  const showOverlay = !prefersReducedMotion && overlayMounted;

  useEffect(() => {
    if (prefersReducedMotion) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const revealTimer = window.setTimeout(() => {
      setTimerRevealed(true);
      document.body.style.overflow = previousOverflow;
    }, REVEAL_AT_MS);

    const hideOverlayTimer = window.setTimeout(() => {
      setOverlayMounted(false);
    }, REVEAL_AT_MS + CROSSFADE_MS);

    return () => {
      window.clearTimeout(revealTimer);
      window.clearTimeout(hideOverlayTimer);
      document.body.style.overflow = previousOverflow;
    };
  }, [prefersReducedMotion]);

  return (
    <>
      {showOverlay && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center bg-zinc-950 transition-opacity ease-out ${
            revealed ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
          style={{ transitionDuration: `${CROSSFADE_MS}ms` }}
          aria-hidden="true"
        >
          <div className="w-full max-w-4xl px-6" style={{ height: 180 }}>
            <ParticleText
              text={title}
              trigger="mount"
              gatherDuration={GATHER_DURATION}
              stagger={STAGGER}
              scatter={220}
              density={3}
              particleSize={2}
              color="#ffffff"
              highlightColor="#d97706"
              fontSize="clamp(2.25rem, 9vw, 3.75rem)"
              fontWeight={700}
              glow
            />
          </div>
        </div>
      )}

      <div
        className={`transition-all ease-out ${
          revealed ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
        }`}
        style={{ transitionDuration: `${CROSSFADE_MS}ms` }}
      >
        {children}
      </div>
    </>
  );
}
