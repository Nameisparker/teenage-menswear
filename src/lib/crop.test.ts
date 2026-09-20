import { describe, expect, it } from "vitest";
import { baseScale, clampOffset, drawRect } from "./crop";

const FRAME = 320;
/** A portrait phone shot — the case the cropper exists for. */
const portrait = { width: 1000, height: 2000 };
const landscape = { width: 2000, height: 1000 };
const square = { width: 1000, height: 1000 };

describe("baseScale", () => {
  it("fits a portrait photo by its long side, leaving bands left and right", () => {
    const scale = baseScale(portrait, FRAME, "contain");
    expect(portrait.height * scale).toBeCloseTo(FRAME);
    expect(portrait.width * scale).toBeLessThan(FRAME);
  });

  it("covers a portrait photo by its short side, cropping top and bottom", () => {
    const scale = baseScale(portrait, FRAME, "cover");
    expect(portrait.width * scale).toBeCloseTo(FRAME);
    expect(portrait.height * scale).toBeGreaterThan(FRAME);
  });

  it("treats a square photo the same either way", () => {
    expect(baseScale(square, FRAME, "contain")).toBeCloseTo(
      baseScale(square, FRAME, "cover")
    );
  });
});

describe("clampOffset", () => {
  it("stops a covering image being dragged far enough to show an empty edge", () => {
    const scale = baseScale(landscape, FRAME, "cover");
    const overshoot = clampOffset({ x: 9999, y: 0 }, landscape, FRAME, scale);
    // At the limit the image's left edge sits exactly on the frame's.
    const { x } = drawRect(landscape, FRAME, scale, overshoot, FRAME);
    expect(x).toBeCloseTo(0);
  });

  it("keeps a fitted image inside the frame", () => {
    const scale = baseScale(portrait, FRAME, "contain");
    const overshoot = clampOffset({ x: -9999, y: 0 }, portrait, FRAME, scale);
    const { x, width } = drawRect(portrait, FRAME, scale, overshoot, FRAME);
    expect(x).toBeCloseTo(0);
    expect(x + width).toBeLessThanOrEqual(FRAME + 0.001);
  });

  it("leaves an in-bounds offset alone", () => {
    const scale = baseScale(landscape, FRAME, "cover");
    expect(clampOffset({ x: 5, y: 0 }, landscape, FRAME, scale)).toEqual({
      x: 5,
      y: 0,
    });
  });
});

describe("drawRect", () => {
  it("centres an untouched cover crop", () => {
    const scale = baseScale(square, FRAME, "cover");
    const rect = drawRect(square, FRAME, scale, { x: 0, y: 0 }, FRAME);
    expect(rect).toMatchObject({ x: 0, y: 0, width: FRAME, height: FRAME });
  });

  it("exports at 1200 exactly what the 320 preview showed", () => {
    const scale = baseScale(portrait, FRAME, "cover");
    const offset = { x: 12, y: -30 };
    const preview = drawRect(portrait, FRAME, scale, offset, FRAME);
    const output = drawRect(portrait, FRAME, scale, offset, 1200);

    // Same rectangle, 3.75x bigger: what you see is what gets uploaded.
    const ratio = 1200 / FRAME;
    expect(output.x).toBeCloseTo(preview.x * ratio);
    expect(output.y).toBeCloseTo(preview.y * ratio);
    expect(output.width).toBeCloseTo(preview.width * ratio);
    expect(output.height).toBeCloseTo(preview.height * ratio);
  });

  it("keeps the crop square regardless of the source shape", () => {
    for (const image of [portrait, landscape, square]) {
      const scale = baseScale(image, FRAME, "cover");
      const rect = drawRect(image, FRAME, scale, { x: 0, y: 0 }, 1200);
      expect(rect.width).toBeGreaterThanOrEqual(1200 - 0.001);
      expect(rect.height).toBeGreaterThanOrEqual(1200 - 0.001);
    }
  });
});
