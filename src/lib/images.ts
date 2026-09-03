/**
 * Where a product image lives, and how to turn that into a URL.
 *
 * `products.image_path` holds one of two things, and both have to keep working:
 *
 *   /products/shirts/shirt_01.jpg   a file under public/, as every row seeded
 *                                   before Storage existed still is
 *   shirts/1757000000000-tee.jpg    a key in the product-images bucket, which
 *                                   is what the admin upload writes now
 *
 * Migrating the old rows is not worth it — the files are committed and served
 * from the same origin, so they are strictly cheaper than the bucket. New
 * products get keys, old ones keep their paths, and this function is the only
 * place that has to know the difference.
 */
import { SUPABASE_URL } from "./supabase/config";

export const PRODUCT_IMAGE_BUCKET = "product-images";

/** Bytes. Anything larger is a photo nobody resized; the optimiser will choke. */
export const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;

export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
];

export function productImageSrc(imagePath: string): string {
  // Absolute URLs are handed straight through: a row may legitimately point at
  // a full public URL, and re-prefixing one would break it.
  if (/^https?:\/\//i.test(imagePath)) return imagePath;
  if (imagePath.startsWith("/")) return imagePath;

  return `${SUPABASE_URL}/storage/v1/object/public/${PRODUCT_IMAGE_BUCKET}/${imagePath}`;
}

/**
 * A stable, collision-proof object key for an upload.
 *
 * The slug makes the bucket browsable by eye; the timestamp is what actually
 * keeps it unique, so re-uploading a replacement never overwrites the file a
 * live product is still pointing at.
 */
export function productImageKey(fileName: string, slugHint: string): string {
  // lastIndexOf, not split(".").pop(): on a name with no dot at all that pop()
  // returns the whole name, so "photo" became the extension.
  const dot = fileName.lastIndexOf(".");
  const extension = dot > 0 ? fileName.slice(dot + 1).toLowerCase() : "jpg";
  const base =
    slugHint
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "product";

  return `${base}-${Date.now()}.${extension}`;
}
