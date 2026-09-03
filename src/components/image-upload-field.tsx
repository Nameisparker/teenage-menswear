"use client";

import { useRef, useState } from "react";
import { ACCEPTED_IMAGE_TYPES } from "@/lib/images";
import { uploadProductImage } from "@/lib/product-image-upload";
import { ProductImage } from "@/components/product-image";

/**
 * The product's cover image, uploaded rather than typed.
 *
 * Deliberately not a Server Action: that would push the whole file through the
 * action body limit for no gain, since the bucket policy already decides who
 * may write. What the form submits is unchanged — a hidden `imagePath` input —
 * so saveProduct did not have to learn anything about Storage.
 */
export function ImageUploadField({ defaultValue = "" }: { defaultValue?: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  /**
   * Names the object after the product being edited.
   *
   * Read off the form rather than passed in as a prop: on a new product the
   * slug does not exist until it is typed, and the file input is already
   * sitting in the same form as the field that has it.
   */
  function slugHint(): string {
    const form = fileRef.current?.form;
    if (!form) return "";
    const field = (name: string) =>
      (form.elements.namedItem(name) as HTMLInputElement | null)?.value ?? "";
    return field("slug") || field("name");
  }

  async function upload(file: File) {
    setUploading(true);
    setError(null);

    const result = await uploadProductImage(file, slugHint());

    setUploading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setValue(result.key);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* The hidden field is the only thing the Server Action reads. */}
      <input type="hidden" name="imagePath" value={value} />

      <div className="flex flex-wrap items-start gap-4">
        {value ? (
          <ProductImage
            image={value}
            name="Cover image preview"
            className="h-28 w-28 flex-shrink-0 rounded-md border border-black/10 dark:border-white/10"
            sizes="112px"
          />
        ) : (
          <div className="flex h-28 w-28 flex-shrink-0 items-center justify-center rounded-md border border-dashed border-black/20 text-xs text-zinc-500 dark:border-white/20 dark:text-zinc-400">
            No image
          </div>
        )}

        <div className="flex flex-col gap-2">
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(",")}
            disabled={uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              // Cleared so picking the same file twice still fires onChange,
              // which is how a retry after a failed upload works.
              event.target.value = "";
              if (file) void upload(file);
            }}
            className="text-sm file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-accent file:px-4 file:py-2 file:text-sm file:font-medium file:text-accent-foreground hover:file:opacity-90 disabled:opacity-60"
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {uploading
              ? "Uploading…"
              : value
                ? `Stored as ${value}`
                : "JPEG, PNG, WebP or AVIF, up to 5 MB."}
          </p>
          {error && (
            <p role="alert" className="text-xs text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </div>
      </div>

      {/* Kept for the seeded products, whose images are files under public/ and
          are edited by path rather than re-uploaded. */}
      <details className="text-sm">
        <summary className="w-fit cursor-pointer text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400">
          Or set the path by hand
        </summary>
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="/products/shirts/shirt_01.jpg"
          aria-label="Image path"
          className="mt-2 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/20"
        />
      </details>
    </div>
  );
}
