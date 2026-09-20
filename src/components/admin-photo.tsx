"use client";

import { useEffect, useState } from "react";
import { useScrollLock } from "@/lib/use-scroll-lock";
import { ImageCropper } from "@/components/image-cropper";
import { ProductImage } from "@/components/product-image";
import { productImageSrc } from "@/lib/images";
import { uploadProductImage } from "@/lib/product-image-upload";

/**
 * A product photo in the admin that opens when clicked.
 *
 * The thumbnails are 96px, which is enough to recognise a photo and not
 * enough to judge one. Clicking shows it at full size, and — when the caller
 * can do something with the result — offers to re-frame it without needing
 * the original file again.
 *
 * Read-only wherever `onReplaced` is omitted, so the same component serves the
 * cover shown for reference inside the gallery strip.
 */
export function AdminPhoto({
  image,
  name,
  className,
  sizes,
  slugHint,
  onReplaced,
}: {
  image: string;
  name: string;
  className?: string;
  sizes?: string;
  /** Names the new object in the bucket, as on first upload. Called at
   *  upload time, not render: the cover field derives it from the live form. */
  slugHint?: () => string;
  /** Given the key of the newly uploaded crop. Absent means view-only. */
  onReplaced?: (imagePath: string) => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`View ${name}`}
        className="block rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <ProductImage
          image={image}
          name={name}
          className={className}
          sizes={sizes}
          padding="p-1"
        />
      </button>

      {open && (
        <PhotoDialog
          image={image}
          name={name}
          slugHint={slugHint}
          onReplaced={onReplaced}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function PhotoDialog({
  image,
  name,
  slugHint,
  onReplaced,
  onClose,
}: {
  image: string;
  name: string;
  slugHint?: () => string;
  onReplaced?: (imagePath: string) => Promise<void> | void;
  onClose: () => void;
}) {
  const [adjusting, setAdjusting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useScrollLock();

  // Escape dismisses the viewer, but not while the cropper is over it — that
  // one handles its own Escape and should only step back a level.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !adjusting) onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, adjusting]);

  async function handleCropped(cropped: File) {
    setAdjusting(false);
    if (!onReplaced) return;

    setBusy(true);
    setError(null);
    // A new key every time, never an overwrite: the old object is immutable
    // and cached for a year, so replacing it in place would leave stale
    // copies in every browser that had seen it.
    const uploaded = await uploadProductImage(cropped, slugHint?.() ?? "product");
    if (!uploaded.ok) {
      setBusy(false);
      setError(uploaded.error);
      return;
    }
    await onReplaced(uploaded.key);
    setBusy(false);
    onClose();
  }

  if (adjusting) {
    return (
      <ImageCropper
        source={productImageSrc(image)}
        onCancel={() => setAdjusting(false)}
        onCropped={handleCropped}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={name}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-black/10 bg-background p-5 shadow-xl dark:border-white/15 sm:rounded-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold">{name}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <ProductImage
          image={image}
          name={name}
          className="mt-4 aspect-square w-full rounded-lg"
          sizes="(min-width: 640px) 640px, 100vw"
          padding="p-2"
        />

        <p className="mt-3 break-all text-xs text-zinc-500 dark:text-zinc-400">
          {image}
        </p>

        {error && (
          <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        {onReplaced && (
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={() => setAdjusting(true)}
              disabled={busy}
              className="flex h-11 items-center justify-center rounded-full bg-accent px-5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Saving…" : "Adjust photo"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
