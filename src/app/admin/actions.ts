"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@/lib/supabase/database.types";
import { MAX_DISCOUNT_PERCENT } from "@/lib/pricing";

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
  if (!imagePath) return { ok: false, error: "Image path is required." };
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
    const { error } = await supabase.from("products").update(row).eq("id", id);
    if (error) {
      return failed("saveProduct update", error.message, "Could not save the product.");
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

  // The storefront caches catalog pages for 60s; drop them now so an admin
  // sees their own edit immediately rather than waiting out the window.
  revalidatePath("/");
  revalidatePath("/products");
  revalidatePath(`/products/${slug}`);
  revalidatePath("/admin/products");

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

  revalidatePath("/admin/orders");
  revalidatePath("/orders");
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
