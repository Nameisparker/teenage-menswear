"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDialog } from "@/lib/use-dialog";
import {
  baseScale,
  clampOffset,
  drawRect,
  type Fit,
  type Offset,
} from "@/lib/crop";

/**
 * Square crop step between picking a file and uploading it.
 *
 * Product photos are shown in a square box with object-contain, so a portrait
 * phone shot arrives letterboxed with the product small in the middle. This
 * lets whoever uploads it decide what the square contains before it is stored,
 * rather than discovering the framing afterwards on the storefront.
 *
 * The preview is a canvas drawn with the same code as the export, so the crop
 * is literally what gets uploaded — not an approximation of it in CSS.
 */

/** Side of the exported square, in pixels. Big enough for the product page. */
const OUTPUT_SIZE = 1200;
/** Side of the on-screen preview, in CSS pixels. */
const FRAME_SIZE = 320;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 4;

export function ImageCropper({
  source,
  onCancel,
  onCropped,
}: {
  /**
   * A freshly picked file, or the URL of one already in the bucket. The
   * second is how an admin re-frames a photo that is already on the product
   * without hunting down the original on their machine.
   */
  source: File | string;
  onCancel: () => void;
  /** Receives the cropped square, ready to hand to uploadProductImage. */
  onCropped: (cropped: File) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  // Absolute scale: displayed pixels per source pixel. Offsets move the image
  // centre away from the frame centre, in CSS pixels.
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number } | null>(null);

  /** Source dimensions, in the shape lib/crop expects. */
  const sizeOf = (img: HTMLImageElement) => ({
    width: img.naturalWidth,
    height: img.naturalHeight,
  });

  const applyFit = useCallback((fit: Fit, img: HTMLImageElement) => {
    setScale(baseScale(sizeOf(img), FRAME_SIZE, fit));
    setOffset({ x: 0, y: 0 });
  }, []);

  // Decode the picked file once. The object URL is revoked on unmount, not
  // after load: the <canvas> keeps drawing from the decoded image, but leaving
  // the URL alive is a leak per upload.
  useEffect(() => {
    const fromFile = typeof source !== "string";
    const url = fromFile ? URL.createObjectURL(source) : source;
    const img = new Image();
    // Required for a stored image: without it the canvas is tainted and
    // toBlob() returns nothing. The bucket is public and serves permissive
    // CORS, which the WebGL gallery already relies on for the same files.
    if (!fromFile) img.crossOrigin = "anonymous";
    img.onload = () => {
      setImage(img);
      // Opens on "cover": a square that is entirely product beats one with
      // two empty bands, and the whole photo is one click away.
      applyFit("cover", img);
    };
    img.onerror = () => setError("That image could not be loaded.");
    img.src = url;
    return () => {
      if (fromFile) URL.revokeObjectURL(url);
    };
  }, [source, applyFit]);

  /**
   * Keeps the photo sensibly placed: when it is larger than the frame it may
   * not be dragged far enough to expose an empty edge, and when it is smaller
   * it may not be dragged out of the frame at all. Both are the same bound.
   */
  const clamp = (next: Offset, img: HTMLImageElement, atScale: number) =>
    clampOffset(next, sizeOf(img), FRAME_SIZE, atScale);

  /**
   * One draw routine for both the preview and the export. `size` is the side
   * of the target square; everything else scales from the frame to it, so the
   * 1200px file matches the 320px preview exactly.
   */
  const draw = useCallback(
    (context: CanvasRenderingContext2D, size: number, img: HTMLImageElement) => {
      const { x, y, width, height } = drawRect(
        sizeOf(img),
        FRAME_SIZE,
        scale,
        offset,
        size
      );

      context.clearRect(0, 0, size, size);
      context.imageSmoothingQuality = "high";
      context.drawImage(img, x, y, width, height);
    },
    [scale, offset]
  );

  // Redraw the preview on every change. Backing store is scaled for the
  // device so the preview is not soft on a retina screen.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = FRAME_SIZE * dpr;
    canvas.height = FRAME_SIZE * dpr;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(context, FRAME_SIZE, image);
  }, [draw, image]);

  useDialog(onCancel);

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!image) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX - offset.x, y: event.clientY - offset.y };
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const start = dragRef.current;
    if (!start || !image) return;
    setOffset(
      clamp(
        { x: event.clientX - start.x, y: event.clientY - start.y },
        image,
        scale
      )
    );
  }

  function handlePointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
  }

  function changeZoom(multiplier: number) {
    if (!image) return;
    const next = baseScale(sizeOf(image), FRAME_SIZE, "contain") * multiplier;
    setScale(next);
    setOffset((current) => clamp(current, image, next));
  }

  /** Where the slider sits: zoom is stored absolutely, shown relative to fit. */
  const zoomValue = image
    ? scale / baseScale(sizeOf(image), FRAME_SIZE, "contain")
    : 1;

  /**
   * The top of the range has to reach "Fill" or the slider lies about where
   * the photo is. On a panorama, cover can be eight times contain — the
   * handle would sit pinned at 4 until the first nudge yanked the photo
   * smaller than the square it had been filling.
   *
   * Derived from the image, never from the current zoom: a max that tracks
   * its own value pins the handle to the right-hand end, and every drag
   * re-widens the track and snaps it back there.
   */
  const maxZoom = image
    ? Math.max(
        MAX_ZOOM,
        baseScale(sizeOf(image), FRAME_SIZE, "cover") /
          baseScale(sizeOf(image), FRAME_SIZE, "contain")
      )
    : MAX_ZOOM;

  async function handleUse() {
    if (!image) return;
    setWorking(true);
    setError(null);

    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const context = canvas.getContext("2d");
    if (!context) {
      setWorking(false);
      setError("Your browser could not render the crop.");
      return;
    }
    draw(context, OUTPUT_SIZE, image);

    // WebP, with alpha: "Fit" leaves the corners empty, and the storefront
    // shows product images over its own background rather than a white block.
    //
    // Guarded because toBlob throws on a canvas tainted by a cross-origin
    // source. Unhandled, the rejection escaped this function with `working`
    // still true, which left the button stuck on "Preparing…" and the backdrop
    // refusing to close — no error, no way out but a reload.
    let blob: Blob | null = null;
    try {
      blob = await new Promise<Blob | null>((resolve, reject) => {
        try {
          canvas.toBlob(resolve, "image/webp", 0.92);
        } catch (encodeError) {
          reject(encodeError);
        }
      });
    } catch (encodeError) {
      console.error("crop encode failed", encodeError);
    }
    setWorking(false);

    if (!blob) {
      setError("Could not process that image. Try a different file.");
      return;
    }

    const original =
      typeof source === "string"
        ? (source.split("/").pop() ?? "photo")
        : source.name;
    const base = original.replace(/\.[^.]+$/, "") || "photo";
    onCropped(new File([blob], `${base}.webp`, { type: "image/webp" }));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget && !working) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Crop image"
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-black/10 bg-background p-6 shadow-xl dark:border-white/15 sm:rounded-2xl"
      >
        <h2 className="text-lg font-semibold">Crop image</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Drag to move, zoom to frame it. Product photos are shown in a square.
        </p>

        <div className="mt-4 flex justify-center">
          {/* The checker backing shows which parts of the square are empty —
              on a plain panel, "Fit" looks identical to a smaller photo. */}
          <canvas
            ref={canvasRef}
            style={{
              width: FRAME_SIZE,
              height: FRAME_SIZE,
              backgroundColor: "#fafafa",
              backgroundImage:
                "linear-gradient(45deg, #e4e4e7 25%, transparent 25%, transparent 75%, #e4e4e7 75%), linear-gradient(45deg, #e4e4e7 25%, transparent 25%, transparent 75%, #e4e4e7 75%)",
              backgroundSize: "16px 16px",
              backgroundPosition: "0 0, 8px 8px",
              touchAction: "none",
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="max-w-full cursor-grab rounded-md border border-black/10 active:cursor-grabbing dark:border-white/15"
          />
        </div>

        <label className="mt-4 flex items-center gap-3 text-sm">
          <span className="w-12 shrink-0 text-zinc-600 dark:text-zinc-400">
            Zoom
          </span>
          <input
            type="range"
            min={MIN_ZOOM}
            max={maxZoom}
            step={0.01}
            value={zoomValue}
            onChange={(event) => changeZoom(Number(event.target.value))}
            className="w-full accent-accent"
          />
        </label>

        <div className="mt-3 flex flex-wrap gap-2">
          <AdjustButton onClick={() => image && applyFit("contain", image)}>
            Fit to square
          </AdjustButton>
          <AdjustButton onClick={() => image && applyFit("cover", image)}>
            Fill square
          </AdjustButton>
          <AdjustButton onClick={() => setOffset({ x: 0, y: 0 })}>
            Recentre
          </AdjustButton>
        </div>

        {error && (
          <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={working}
            className="flex h-11 items-center justify-center rounded-full border border-black/15 px-5 text-sm font-medium transition-colors hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUse}
            disabled={!image || working}
            className="flex h-11 items-center justify-center rounded-full bg-accent px-5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {working ? "Preparing…" : "Use photo"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AdjustButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-black/15 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
    >
      {children}
    </button>
  );
}
