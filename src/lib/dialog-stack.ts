/**
 * Which modal is on top.
 *
 * Every dialog listens for Escape on `document`, so when one opens over
 * another both listeners fire on the same key press and both close — press
 * Escape on the sign-in prompt raised from quick view and the product behind
 * it vanishes too. Only the topmost dialog should answer.
 *
 * Dialogs register on mount and unregister on unmount; the last one in is the
 * one that handles the key. Kept free of the DOM so the ordering can be
 * tested without a browser.
 */

export type DialogToken = { readonly id: number };

let nextId = 1;
let stack: DialogToken[] = [];

export function pushDialog(): DialogToken {
  const token = { id: nextId++ };
  stack.push(token);
  return token;
}

export function popDialog(token: DialogToken): void {
  // Filtered rather than popped: dialogs do not always unmount in the order
  // they mounted, and removing the wrong one would leave a dead token on top
  // swallowing every Escape after it.
  stack = stack.filter((entry) => entry !== token);
}

export function isTopDialog(token: DialogToken): boolean {
  return stack.length > 0 && stack[stack.length - 1] === token;
}

/** Test seam: drops any registered dialogs. */
export function resetDialogStack(): void {
  stack = [];
}

/** How many dialogs are currently open. Exposed for tests. */
export function dialogDepth(): number {
  return stack.length;
}
