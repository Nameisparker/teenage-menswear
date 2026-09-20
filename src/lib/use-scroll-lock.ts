"use client";

import { useEffect } from "react";
import { acquireScrollLock, releaseScrollLock } from "./scroll-lock";

/**
 * Freezes the page behind a modal for as long as the component is mounted.
 *
 * Every dialog in the app calls this rather than touching
 * document.body.style itself, so that dialogs opened on top of one another
 * unlock in the right order — see lib/scroll-lock.
 */
export function useScrollLock(): void {
  useEffect(() => {
    const style = document.body.style;
    acquireScrollLock(style);
    return () => releaseScrollLock(style);
  }, []);
}
