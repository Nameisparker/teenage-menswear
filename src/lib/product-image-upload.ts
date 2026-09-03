/**
 * Uploading one product image from the browser.
 *
 * Shared by the cover-image field and the gallery editor so the validation
 * rules, the bucket and the key format live in one place. The upload runs with
 * the admin's own session: the "Admins upload product images" policy on
 * storage.objects is what authorises it, not the screen it was called from.
 */
import { getSupabaseBrowserClient } from "./supabase/client";
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_PRODUCT_IMAGE_BYTES,
  PRODUCT_IMAGE_BUCKET,
  productImageKey,
} from "./images";

export type UploadResult =
  | { ok: true; key: string }
  | { ok: false; error: string };

export async function uploadProductImage(
  file: File,
  slugHint: string
): Promise<UploadResult> {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return { ok: false, error: "Use a JPEG, PNG, WebP or AVIF image." };
  }
  if (file.size > MAX_PRODUCT_IMAGE_BYTES) {
    const limit = Math.round(MAX_PRODUCT_IMAGE_BYTES / (1024 * 1024));
    return {
      ok: false,
      error: `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. Keep it under ${limit} MB.`,
    };
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return {
      ok: false,
      error: "Supabase is not configured, so there is nowhere to upload to.",
    };
  }

  const key = productImageKey(file.name, slugHint);
  const { error } = await supabase.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .upload(key, file, {
      // A key is unique per upload, so the file at one is immutable and can be
      // cached for a year. Replacing an image writes a new key.
      cacheControl: "31536000",
      upsert: false,
    });

  if (error) {
    console.error("product image upload", error);
    const message = error.message.toLowerCase();
    return {
      ok: false,
      error:
        message.includes("row-level security") ||
        message.includes("unauthorized") ||
        message.includes("permission")
          ? "You do not have permission to upload images."
          : "Could not upload that image. Try again.",
    };
  }

  return { ok: true, key };
}
