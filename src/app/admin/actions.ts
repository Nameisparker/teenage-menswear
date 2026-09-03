"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@/lib/supabase/database.types";
import { MAX_DISCOUNT_PERCENT } from "@/lib/pricing";
import { PRODUCT_IMAGE_BUCKET } from "@/lib/images";

/**
 * Admin mutations.
 *
 * These use the caller's session, so RLS is the actual authorisation: only a
 * profile with role = 'admin' satisfies the "Admins manage products" policies.
 * The is-admin check below is a UX nicety that produces a clear message — it is
 * NOT the security boundary. A non-admin who called these directly would be
 * refused by the database regardless.
 */

export type ActionResult = { ok: boolean; error?: string };

/** Sizes arrive as a comma-separated string; "S, M,L" -> ["S","M","L"]. */
function parseSizes(raw: string): string[] {
  const seen = new Set<string>();
  return raw
    .split(",")
    .map((size) => size.trim())
    .filter((size) => size.length > 0 && !seen.has(size) && seen.add(size));
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function requireAdmin() {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return { supabase: null, error: "Supabase is not configured." };

  const { data } = await supabase.rpc("is_admin");
  if (data !== true) {
    return { supabase: null, error: "You do not have admin access." };
  }
  return { supabase, error: null as string | null };
}

/**
 * Turns a Postgres error into something an admin can act on.
 *
 * Raw messages name constraints, not fields — "duplicate key value violates
 * unique constraint products_slug_key" does not tell you which box to change.
 * The original is logged for whoever has to debug it.
 */
function friendlyDbError(message: string, fallback: string): string {
  const lower = message.toLowerCase();

  if (lower.includes("products_slug_key")) {
    return "That slug is already used by another product. Pick a different one.";
  }
  if (lower.includes("duplicate key")) {
    return "That value is already taken. Try a different one.";
  }
  if (lower.includes("discount_percent")) {
    return `Discount must be between 0 and ${MAX_DISCOUNT_PERCENT}%.`;
  }
  if (lower.includes("products_price_check")) {
    return "Price must be a whole number above zero.";
  }
  if (lower.includes("foreign key")) {
    return "That category no longer exists. Reload the page and try again.";
  }
  if (lower.includes("row-level security") || lower.includes("permission denied")) {
    return "You do not have permission to do that.";
  }
  if (lower.includes("fetch") || lower.includes("network")) {
    return "Could not reach the database. Check your connection and retry.";
  }
  return fallback;
}

/** Logs the real error, returns the readable one. */
function failed(context: string, message: string, fallback: string): ActionResult {
  console.error(`${context}:`, message);
  return { ok: false, error: friendlyDbError(message, fallback) };
}

/** Replaces a product’s size list, preserving stock for sizes that remain. */
async function syncVariants(
  supabase: NonNullable<Awaited<ReturnType<typeof getSupabaseServerClient>>>,
  productId: string,
  sizes: string[]
): Promise<string | null> {
  const { data: existing, error: readError } = await supabase
    .from("product_variants")
    .select("size")
    .eq("product_id", productId);

  if (readError) return readError.message;

  const existingSizes = new Set(
    (existing as { size: string }[]).map((row) => row.size)
  );

  // Remove sizes no longer offered.
  const removed = [...existingSizes].filter((size) => !sizes.includes(size));
  if (removed.length > 0) {
    const { error } = await supabase
      .from("product_variants")
      .delete()
      .eq("product_id", productId)
      .in("size", removed);
    if (error) return error.message;
  }

  // Upsert the current list so sort_order tracks the order they were typed in.
  const rows = sizes.map((size, index) => ({
    product_id: productId,
    size,
    sort_order: index,
    // Only used for sizes being inserted; existing rows keep their stock
    // because we do not include it in the update columns below.
    stock: 0,
  }));

  if (rows.length > 0) {
    const toInsert = rows.filter((row) => !existingSizes.has(row.size));
    if (toInsert.length > 0) {
      const { error } = await supabase.from("product_variants").insert(toInsert);
      if (error) return error.message;
    }
    // Refresh ordering for the ones that already existed.
    for (const row of rows.filter((r) => existingSizes.has(r.size))) {
      const { error } = await supabase
        .from("product_variants")
        .update({ sort_order: row.sort_order })
        .eq("product_id", productId)
        .eq("size", row.size);
      if (error) return error.message;
    }
  }

  return null;
}
/**
 * Deletes an image that nothing points at any more.
 *
 * Only for objects in the bucket: a path under /public is a committed file and
 * deleting it is not this function's business. The "is anyone still using it?"
 * check is the point, and it has to look in both places — a file can be one
 * product's cover and another's second angle, and swapping either must not
 * blank the other.
 *
 * Every failure is logged and swallowed. An orphaned object costs a fraction of
 * a cent; a save that fails because a cleanup did is a real problem.
 */
async function deleteUnusedImage(
  supabase: NonNullable<Awaited<ReturnType<typeof getSupabaseServerClient>>>,
  imagePath: string
): Promise<void> {
  if (!imagePath || imagePath.startsWith("/") || /^https?:\/\//i.test(imagePath)) {
    return;
  }

  const [covers, gallery] = await Promise.all([
    supabase.from("products").select("id").eq("image_path", imagePath).limit(1),
    supabase
      .from("product_images")
      .select("id")
      .eq("image_path", imagePath)
      .limit(1),
  ]);

  if (covers.error || gallery.error) {
    console.error(
      "deleteUnusedImage lookup:",
      covers.error?.message ?? gallery.error?.message
    );
    return;
  }
  if (covers.data.length > 0 || gallery.data.length > 0) return;

  const { error: removeError } = await supabase.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .remove([imagePath]);

  if (removeError) {
    console.error("deleteUnusedImage remove:", removeError.message);
  }
}

export async function saveProduct(
  formData: FormData
): Promise<ActionResult> {
  const { supabase, error: adminError } = await requireAdmin();
  if (!supabase) return { ok: false, error: adminError ?? "Unauthorised." };

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const slug =
    String(formData.get("slug") ?? "").trim() || slugify(name);
  const categoryId = String(formData.get("categoryId") ?? "");
  const price = Number(formData.get("price"));
  const description = String(formData.get("description") ?? "").trim();
  const imagePath = String(formData.get("imagePath") ?? "").trim();
  const featured = formData.get("featured") === "on";
  const isActive = formData.get("isActive") === "on";
  const sizes = parseSizes(String(formData.get("sizes") ?? ""));

  if (!name) return { ok: false, error: "Name is required." };
  if (!slug) return { ok: false, error: "Slug is required." };
  if (!categoryId) return { ok: false, error: "Pick a category." };
  if (!Number.isFinite(price) || price <= 0) {
    return { ok: false, error: "Price must be a whole number above zero." };
  }
  if (!imagePath) return { ok: false, error: "Upload an image for this product." };
  if (sizes.length === 0) {
    return { ok: false, error: "Add at least one size." };
  }

  const row = {
    slug,
    name,
    category_id: categoryId,
    price: Math.round(price),
    description,
    image_path: imagePath,
    featured,
    is_active: isActive,
  };

  let productId = id;

  if (id) {
    // Read before writing so a swapped-out image can be cleaned up after.
    const { data: existing } = await supabase
      .from("products")
      .select("image_path")
      .eq("id", id)
      .maybeSingle();

    const { error } = await supabase.from("products").update(row).eq("id", id);
    if (error) {
      return failed("saveProduct update", error.message, "Could not save the product.");
    }

    const previous = (existing as { image_path: string } | null)?.image_path;
    if (previous && previous !== imagePath) {
      await deleteUnusedImage(supabase, previous);
    }
  } else {
    const { data, error } = await supabase
      .from("products")
      .insert(row)
      .select("id")
      .single();
    if (error) {
      return failed("saveProduct insert", error.message, "Could not create the product.");
    }
    productId = (data as { id: string }).id;
  }

  const variantError = await syncVariants(supabase, productId, sizes);
  if (variantError) {
    return failed("syncVariants", variantError, "Could not save the sizes.");
  }

  /**
   * Stock arrives as `stock:<size>` fields from the edit form, so the page has
   * one save button instead of one per size.
   *
   * After syncVariants, so a size added in this same save exists to receive a
   * number, and filtered to the sizes that survived it, so the box for a size
   * just removed is ignored rather than recreating it. Validated in full before
   * anything is written: a bad number in the third box must not leave the first
   * two applied.
   */
  const stockFields = [...formData.entries()]
    .filter(([key]) => key.startsWith("stock:"))
    .map(([key, value]) => ({
      size: key.slice("stock:".length),
      units: Number(value),
    }))
    .filter((field) => sizes.includes(field.size));

  for (const field of stockFields) {
    if (!Number.isInteger(field.units) || field.units < 0) {
      return {
        ok: false,
        error: `Stock for size ${field.size} must be a whole number, zero or more.`,
      };
    }
  }

  for (const field of stockFields) {
    const { error } = await supabase
      .from("product_variants")
      .update({ stock: field.units })
      .eq("product_id", productId)
      .eq("size", field.size);

    if (error) {
      return failed("saveProduct stock", error.message, "Could not save the stock.");
    }
  }

  // The storefront caches catalog pages for 60s; drop them now so an admin
  // sees their own edit immediately rather than waiting out the window.
  revalidatePath("/");
  revalidatePath("/products");
  revalidatePath(`/products/${slug}`);
  revalidatePath("/admin/products");
  // Stock moved, so the dashboard's counts and restock list did too.
  revalidatePath("/admin");

  return { ok: true };
}


/**
 * Adds one more image to a product's gallery.
 *
 * The file is already in the bucket — the browser put it there with the admin's
 * own session — so this only records it. sort_order is one past the current
 * highest, which makes upload order the display order.
 */
export async function addProductImage(
  productId: string,
  imagePath: string
): Promise<ActionResult> {
  const { supabase, error: adminError } = await requireAdmin();
  if (!supabase) return { ok: false, error: adminError ?? "Unauthorised." };

  if (!imagePath.trim()) return { ok: false, error: "No image to add." };

  const { data: last, error: readError } = await supabase
    .from("product_images")
    .select("sort_order")
    .eq("product_id", productId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (readError) {
    return failed("addProductImage read", readError.message, "Could not add the image.");
  }

  const nextOrder = ((last as { sort_order: number } | null)?.sort_order ?? -1) + 1;

  const { error } = await supabase
    .from("product_images")
    .insert({
      product_id: productId,
      image_path: imagePath.trim(),
      sort_order: nextOrder,
    });

  if (error) {
    return failed("addProductImage", error.message, "Could not add the image.");
  }

  revalidatePath("/products/[slug]", "page");
  revalidatePath("/admin/products/[id]", "page");
  return { ok: true };
}

/**
 * Removes a gallery image, and the file behind it when nothing else uses it.
 *
 * The row is read before it is deleted because the path is needed afterwards,
 * and reading it back once it is gone is not an option.
 */
export async function removeProductImage(imageId: string): Promise<ActionResult> {
  const { supabase, error: adminError } = await requireAdmin();
  if (!supabase) return { ok: false, error: adminError ?? "Unauthorised." };

  const { data: image, error: readError } = await supabase
    .from("product_images")
    .select("image_path")
    .eq("id", imageId)
    .maybeSingle();

  if (readError) {
    return failed("removeProductImage read", readError.message, "Could not remove the image.");
  }

  const { error } = await supabase
    .from("product_images")
    .delete()
    .eq("id", imageId);

  if (error) {
    return failed("removeProductImage", error.message, "Could not remove the image.");
  }

  const path = (image as { image_path: string } | null)?.image_path;
  if (path) await deleteUnusedImage(supabase, path);

  revalidatePath("/products/[slug]", "page");
  revalidatePath("/admin/products/[id]", "page");
  return { ok: true };
}
export async function setProductActive(
  productId: string,
  isActive: boolean
): Promise<ActionResult> {
  const { supabase, error: adminError } = await requireAdmin();
  if (!supabase) return { ok: false, error: adminError ?? "Unauthorised." };

  const { error } = await supabase
    .from("products")
    .update({ is_active: isActive })
    .eq("id", productId);

  if (error) {
    return failed("setProductActive", error.message, "Could not update visibility.");
  }

  revalidatePath("/");
  revalidatePath("/products");
  revalidatePath("/admin/products");
  return { ok: true };
}


/**
 * Adds or removes a product from the featured list.
 *
 * Also settable on the product form, but curating the home page one product at
 * a time through a form is not curating — the featured screen needs to flip the
 * flag in place.
 */
export async function setProductFeatured(
  productId: string,
  featured: boolean
): Promise<ActionResult> {
  const { supabase, error: adminError } = await requireAdmin();
  if (!supabase) return { ok: false, error: adminError ?? "Unauthorised." };

  const { error } = await supabase
    .from("products")
    .update({ featured })
    .eq("id", productId);

  if (error) {
    return failed(
      "setProductFeatured",
      error.message,
      "Could not update the featured list."
    );
  }

  // The home page's featured block reads this flag, and so does the default
  // "Featured" sort on /products.
  revalidatePath("/");
  revalidatePath("/products");
  revalidatePath("/admin/products");
  revalidatePath("/admin/featured");
  return { ok: true };
}

export async function setOrderStatus(
  orderId: string,
  status: OrderStatus
): Promise<ActionResult> {
  const { supabase, error: adminError } = await requireAdmin();
  if (!supabase) return { ok: false, error: adminError ?? "Unauthorised." };

  // The log_order_status trigger appends to order_events, which is what the
  // customer's tracking timeline reads.
  const { error } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", orderId);

  if (error) {
    return failed("setOrderStatus", error.message, "Could not update the order.");
  }

  // Best effort. The status change is committed and the customer's tracking
  // timeline already shows it; a bounced email must not turn a successful
  // update into a failure the admin has to retry.
  try {
    await supabase.functions.invoke("notify-order", {
      body: { orderId, event: "status" },
    });
  } catch (notifyError) {
    console.error("setOrderStatus notify", notifyError);
  }

  revalidatePath("/admin/orders");
  // The detail page shows the same status and its own history timeline, so
  // it goes stale too if only the list is revalidated.
  revalidatePath("/admin/orders/[orderNumber]", "page");
  revalidatePath("/orders");
  revalidatePath("/orders/[orderNumber]", "page");
  return { ok: true };
}

/**
 * Sets a product's discount. The offer price is not written here — the
 * products.offer_price generated column derives it, so there is exactly one
 * place that does the arithmetic and it is the one place that bills.
 */
export async function setProductDiscount(
  productId: string,
  discountPercent: number
): Promise<ActionResult> {
  const { supabase, error: adminError } = await requireAdmin();
  if (!supabase) return { ok: false, error: adminError ?? "Unauthorised." };

  if (!Number.isInteger(discountPercent)) {
    return { ok: false, error: "Discount must be a whole number." };
  }
  if (discountPercent < 0 || discountPercent > MAX_DISCOUNT_PERCENT) {
    return {
      ok: false,
      error: `Discount must be between 0 and ${MAX_DISCOUNT_PERCENT}%.`,
    };
  }

  const { data, error } = await supabase
    .from("products")
    .update({ discount_percent: discountPercent })
    .eq("id", productId)
    .select("slug")
    .single();

  if (error) {
    return failed("setProductDiscount", error.message, "Could not save the discount.");
  }

  // Catalog pages cache for 60s; an admin should see the new price at once.
  revalidatePath("/");
  revalidatePath("/products");
  revalidatePath(`/products/${(data as { slug: string }).slug}`);
  revalidatePath("/cart");
  revalidatePath("/admin/products");
  revalidatePath("/admin/discounts");

  return { ok: true };
}
