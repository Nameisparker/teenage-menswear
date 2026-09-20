"use client";

import { useEffect, useRef } from "react";
import { acquireScrollLock, releaseScrollLock } from "./scroll-lock";
import { isTopDialog, popDialog, pushDialog } from "./dialog-stack";

/**
 * The two things every modal in this app needs: the page frozen behind it, and
 * Escape to dismiss it — but only while it is the dialog on top.
 *
 * One hook rather than two effects per dialog, because getting either wrong is
 * invisible until two dialogs overlap. See lib/scroll-lock and
 * lib/dialog-stack for what each half is guarding against.
 */
export function useDialog(onDismiss: () => void): void {
  // Held in a ref so the effect below can run once, on mount. Taking the
  // callback as a dependency would re-register the dialog on every render of
  // the parent, shuffling it to the top of the stack each time.
  const dismissRef = useRef(onDismiss);
  useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    const style = document.body.style;
    acquireScrollLock(style);
    const token = pushDialog();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && isTopDialog(token)) dismissRef.current();
    }
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      popDialog(token);
      releaseScrollLock(style);
    };
  }, []);
}
