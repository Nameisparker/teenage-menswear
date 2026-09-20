/**
 * Page scroll locking for modal dialogs, counted rather than per-dialog.
 *
 * Every dialog used to save document.body.style.overflow on mount and put it
 * back on unmount, which breaks the moment two of them overlap. Opening the
 * cropper from the photo viewer did exactly that: the inner dialog locked
 * while the outer one was already holding "hidden", so the outer one recorded
 * "hidden" as the value to restore and the page stayed frozen after both had
 * closed.
 *
 * A single counter fixes it. The first acquire records the real value and
 * locks; the last release puts that value back. Anything in between only
 * moves the count.
 *
 * The target is passed in rather than read from `document` so the counting can
 * be tested without a browser.
 */

export type ScrollLockTarget = { overflow: string };

let depth = 0;
let restoreTo = "";

export function acquireScrollLock(style: ScrollLockTarget): void {
  if (depth === 0) {
    restoreTo = style.overflow;
    style.overflow = "hidden";
  }
  depth += 1;
}

export function releaseScrollLock(style: ScrollLockTarget): void {
  // Guards a release without a matching acquire, which would otherwise drive
  // the count negative and leave the next lock unable to unlock.
  if (depth === 0) return;
  depth -= 1;
  if (depth === 0) style.overflow = restoreTo;
}

/** Test seam: drops any held locks so cases cannot leak into each other. */
export function resetScrollLock(): void {
  depth = 0;
  restoreTo = "";
}

/** How many dialogs currently hold the lock. Exposed for tests. */
export function scrollLockDepth(): number {
  return depth;
}
