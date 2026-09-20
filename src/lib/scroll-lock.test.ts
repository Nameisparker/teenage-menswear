import { beforeEach, describe, expect, it } from "vitest";
import {
  acquireScrollLock,
  releaseScrollLock,
  resetScrollLock,
  scrollLockDepth,
} from "./scroll-lock";

/** Stands in for document.body.style. */
const body = () => ({ overflow: "" });

beforeEach(resetScrollLock);

describe("scroll lock", () => {
  it("locks on the first acquire and restores on the matching release", () => {
    const style = body();
    acquireScrollLock(style);
    expect(style.overflow).toBe("hidden");
    releaseScrollLock(style);
    expect(style.overflow).toBe("");
  });

  it("keeps the page locked while an outer dialog is still open", () => {
    const style = body();
    acquireScrollLock(style); // photo viewer
    acquireScrollLock(style); // cropper opened on top of it

    releaseScrollLock(style); // cropper closes
    expect(style.overflow).toBe("hidden");
    expect(scrollLockDepth()).toBe(1);

    releaseScrollLock(style); // viewer closes
    expect(style.overflow).toBe("");
  });

  it("never restores 'hidden' as the unlocked value", () => {
    // The old bug: the second dialog recorded the first one's lock as the
    // value to put back, so the page stayed frozen once both had closed.
    const style = body();
    acquireScrollLock(style);
    acquireScrollLock(style);
    releaseScrollLock(style);
    releaseScrollLock(style);
    expect(style.overflow).not.toBe("hidden");
  });

  it("preserves a page that was already unscrollable for another reason", () => {
    const style = { overflow: "clip" };
    acquireScrollLock(style);
    releaseScrollLock(style);
    expect(style.overflow).toBe("clip");
  });

  it("ignores a release with no lock held", () => {
    const style = body();
    releaseScrollLock(style);
    expect(scrollLockDepth()).toBe(0);
    // The stray release must not stop the next real lock from unlocking.
    acquireScrollLock(style);
    releaseScrollLock(style);
    expect(style.overflow).toBe("");
  });

  it("survives a dialog remounting, as React does in development", () => {
    const style = body();
    acquireScrollLock(style);
    releaseScrollLock(style);
    acquireScrollLock(style);
    expect(style.overflow).toBe("hidden");
    releaseScrollLock(style);
    expect(style.overflow).toBe("");
  });
});
