import { beforeEach, describe, expect, it } from "vitest";
import {
  dialogDepth,
  isTopDialog,
  popDialog,
  pushDialog,
  resetDialogStack,
} from "./dialog-stack";

beforeEach(resetDialogStack);

describe("dialog stack", () => {
  it("makes a lone dialog the top one", () => {
    const only = pushDialog();
    expect(isTopDialog(only)).toBe(true);
  });

  it("hands Escape to the dialog opened last", () => {
    const quickView = pushDialog();
    const signIn = pushDialog();

    // The old bug: both answered the same key press, so Escape on the sign-in
    // prompt also closed the product behind it.
    expect(isTopDialog(signIn)).toBe(true);
    expect(isTopDialog(quickView)).toBe(false);
  });

  it("gives control back to the one underneath when the top closes", () => {
    const quickView = pushDialog();
    const signIn = pushDialog();

    popDialog(signIn);
    expect(isTopDialog(quickView)).toBe(true);
    expect(dialogDepth()).toBe(1);
  });

  it("survives dialogs closing out of order", () => {
    const outer = pushDialog();
    const inner = pushDialog();

    // The outer one unmounting first must not leave a dead token on top
    // swallowing every later Escape.
    popDialog(outer);
    expect(isTopDialog(inner)).toBe(true);
    popDialog(inner);
    expect(dialogDepth()).toBe(0);
  });

  it("treats a token that was never pushed as not on top", () => {
    pushDialog();
    expect(isTopDialog({ id: -1 })).toBe(false);
  });

  it("reports no top dialog once everything has closed", () => {
    const one = pushDialog();
    popDialog(one);
    expect(isTopDialog(one)).toBe(false);
    expect(dialogDepth()).toBe(0);
  });

  it("ignores a double unregister", () => {
    const a = pushDialog();
    const b = pushDialog();
    popDialog(b);
    popDialog(b);
    expect(dialogDepth()).toBe(1);
    expect(isTopDialog(a)).toBe(true);
  });
});
