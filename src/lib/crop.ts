/**
 * Geometry for the square image cropper.
 *
 * Pure functions, separate from the component, because this is the maths that
 * decides what actually gets uploaded — the preview and the exported file both
 * run through it, and it is the one part of the cropper that can be checked
 * without a browser.
 */

export type Size = { width: number; height: number };
export type Offset = { x: number; y: number };
export type Fit = "contain" | "cover";

/**
 * Scale at which the image exactly fits inside the square ("contain") or
 * exactly covers it ("cover"), in displayed pixels per source pixel.
 */
export function baseScale(image: Size, frame: number, fit: Fit): number {
  const byWidth = frame / image.width;
  const byHeight = frame / image.height;
  return fit === "contain"
    ? Math.min(byWidth, byHeight)
    : Math.max(byWidth, byHeight);
}

/**
 * Holds the image somewhere sensible in the frame.
 *
 * Larger than the frame: it may not be dragged far enough to expose an empty
 * edge. Smaller: it may not be dragged out of the frame at all. Both come out
 * as the same bound, half the difference between the two sizes.
 */
export function clampOffset(
  offset: Offset,
  image: Size,
  frame: number,
  scale: number
): Offset {
  const limitX = Math.abs(image.width * scale - frame) / 2;
  const limitY = Math.abs(image.height * scale - frame) / 2;
  return {
    x: Math.max(-limitX, Math.min(limitX, offset.x)),
    y: Math.max(-limitY, Math.min(limitY, offset.y)),
  };
}

/**
 * Where to draw the image on a square canvas of `size`.
 *
 * `frame` is the preview's side, so the same state renders identically at
 * 320px on screen and 1200px in the exported file.
 */
export function drawRect(
  image: Size,
  frame: number,
  scale: number,
  offset: Offset,
  size: number
): { x: number; y: number; width: number; height: number } {
  const ratio = size / frame;
  const width = image.width * scale * ratio;
  const height = image.height * scale * ratio;
  return {
    x: size / 2 + offset.x * ratio - width / 2,
    y: size / 2 + offset.y * ratio - height / 2,
    width,
    height,
  };
}
