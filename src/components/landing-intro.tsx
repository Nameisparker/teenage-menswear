"use client";

import { useEffect, useState, type ReactNode } from "react";
import ParticleText from "./particle-text";

const GATHER_DURATION = 1400;
const STAGGER = 350;
const HOLD_MS = 300;
const CROSSFADE_MS = 700;
const REVEAL_AT_MS = GATHER_DURATION + STAGGER + HOLD_MS;

export function LandingIntro({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const [revealed, setRevealed] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);

  useEffect(() => {
    const prefersReducedMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ??
      false;

    if (prefersReducedMotion) {
      setRevealed(true);
      setShowOverlay(false);
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const revealTimer = window.setTimeout(() => {
      setRevealed(true);
      document.body.style.overflow = previousOverflow;
    }, REVEAL_AT_MS);

    const hideOverlayTimer = window.setTimeout(() => {
      setShowOverlay(false);
    }, REVEAL_AT_MS + CROSSFADE_MS);

    return () => {
      window.clearTimeout(revealTimer);
      window.clearTimeout(hideOverlayTimer);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

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
