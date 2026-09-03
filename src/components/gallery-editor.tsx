"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addProductImage, removeProductImage } from "@/app/admin/actions";
import { ACCEPTED_IMAGE_TYPES } from "@/lib/images";
import { uploadProductImage } from "@/lib/product-image-upload";
import { ProductImage } from "@/components/product-image";
import type { AdminProduct } from "@/lib/admin-catalog";

/**
 * The extra angles shown after the cover on the product page.
 *
 * Two steps per image, deliberately: the file goes to the bucket from the
 * browser, then a Server Action records the row. Uploading through the action
 * would push the whole file through its body limit to reach a bucket the
 * browser can already write to.
 *
 * Order is upload order. Reordering needs a control worth building — dragging,
 * or at least up and down — and until then adding them in the order you want
 * is not a hardship.
 */
export function GalleryEditor({ product }: { product: AdminProduct }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();

  const busy = uploading || pending;

  async function add(file: File) {
    setUploading(true);
    setError(null);

    const uploaded = await uploadProductImage(file, product.slug);
    if (!uploaded.ok) {
      setUploading(false);
      setError(uploaded.error);
      return;
    }

    const result = await addProductImage(product.id, uploaded.key);
    setUploading(false);

    if (!result.ok) {
      setError(result.error ?? "Could not add the image.");
      return;
    }
    router.refresh();
  }

  function remove(imageId: string) {
    startTransition(async () => {
      const result = await removeProductImage(imageId);
      if (!result.ok) {
        setError(result.error ?? "Could not remove the image.");
        return;
      }
      setError(null);
      router.refresh();
    });
  }

  return (
    <section className="flex max-w-2xl flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Gallery</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {product.galleryImages.length === 0
            ? "Only the cover image. Add more angles and the product page shows a thumbnail strip."
            : `${product.galleryImages.length} extra image${
                product.galleryImages.length === 1 ? "" : "s"
              }, shown after the cover in this order.`}
        </p>
      </div>

      <ul className="flex flex-wrap gap-3">
        {/* The cover is in the strip because that is where it appears on the
            storefront, but it is edited above, not here. */}
        <li className="flex flex-col items-center gap-1">
          <ProductImage
            image={product.imagePath}
            name="Cover image"
            className="h-24 w-24 rounded-md border border-black/10 dark:border-white/10"
            sizes="96px"
          />
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Cover</span>
        </li>

        {product.galleryImages.map((image, index) => (
          <li key={image.id} className="flex flex-col items-center gap-1">
            <ProductImage
              image={image.imagePath}
              name={`Gallery image ${index + 2}`}
              className="h-24 w-24 rounded-md border border-black/10 dark:border-white/10"
              sizes="96px"
            />
            <button
              type="button"
              onClick={() => remove(image.id)}
              disabled={busy}
              className="text-xs text-red-600 underline-offset-2 hover:underline disabled:opacity-40 dark:text-red-400"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-2">
        <input
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(",")}
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            // Cleared so the same file can be picked again after a failure.
            event.target.value = "";
            if (file) void add(file);
          }}
          aria-label="Add a gallery image"
          className="text-sm file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-accent file:px-4 file:py-2 file:text-sm file:font-medium file:text-accent-foreground hover:file:opacity-90 disabled:opacity-60"
        />
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {uploading ? "Uploading…" : "JPEG, PNG, WebP or AVIF, up to 5 MB."}
        </p>
        {error && (
          <p role="alert" className="text-xs text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
