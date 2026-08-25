/**
 * Catalog reads for the admin screens.
 *
 * Separate from src/lib/catalog.ts because these must use the session-bound
 * client: admins see inactive products, which the public policy hides, and that
 * only works when the request carries the admin's session.
 */
import { getSupabaseServerClient } from "./supabase/server";
import type { OrderStatus } from "./supabase/database.types";

/**
 * A failed query and an empty table are not the same thing, and returning [] for
 * both makes a database outage look like "you have no products" — an admin then
 * re-adds a catalog that never went away. These reads still degrade to empty so a
 * page never crashes, but the cause is logged rather than swallowed.
 */
function logQueryError(context: string, message: string) {
  console.error(`admin-catalog ${context}:`, message);
}

export type AdminProduct = {
  id: string;
  slug: string;
  name: string;
  price: number;
  discountPercent: number;
  offerPrice: number;
  description: string;
  imagePath: string;
  featured: boolean;
  isActive: boolean;
  categoryId: string;
  categorySlug: string;
  sizes: string[];
};

const ADMIN_PRODUCT_SELECT = `
  id, slug, name, price, discount_percent, offer_price, description, image_path, featured, is_active, category_id,
  categories!inner ( slug, label ),
  product_variants ( size, sort_order )
`;

type AdminProductRow = {
  id: string;
  slug: string;
  name: string;
  price: number;
  discount_percent: number;
  offer_price: number;
  description: string;
  image_path: string;
  featured: boolean;
  is_active: boolean;
  category_id: string;
  categories: { slug: string; label: string };
  product_variants: { size: string; sort_order: number }[];
};

function toAdminProduct(row: AdminProductRow): AdminProduct {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    price: row.price,
    discountPercent: row.discount_percent,
    offerPrice: row.offer_price,
    description: row.description,
    imagePath: row.image_path,
    featured: row.featured,
    isActive: row.is_active,
    categoryId: row.category_id,
    categorySlug: row.categories.slug,
    sizes: [...row.product_variants]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((variant) => variant.size),
  };
}

/** Every product, active or not, newest first. */
export async function getAllProducts(): Promise<AdminProduct[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("products")
    .select(ADMIN_PRODUCT_SELECT)
    .order("name");

  if (error || !data) {
    if (error) logQueryError("getAllProducts", error.message);
    return [];
  }
  return (data as unknown as AdminProductRow[]).map(toAdminProduct);
}

export async function getProductById(
  id: string
): Promise<AdminProduct | null> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("products")
    .select(ADMIN_PRODUCT_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    if (error) logQueryError("getProductById", error.message);
    return null;
  }
  return toAdminProduct(data as unknown as AdminProductRow);
}

export async function getCategoryOptions(): Promise<
  { id: string; slug: string; label: string }[]
> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("categories")
    .select("id, slug, label")
    .order("sort_order");

  if (error || !data) {
    if (error) logQueryError("getCategoryOptions", error.message);
    return [];
  }
  return data as { id: string; slug: string; label: string }[];
}

export type AdminOrder = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  total: number;
  placedAt: string;
  customerName: string;
  customerPhone: string;
  itemCount: number;
};

/** Every order, newest first. Visible only to admins, via RLS. */
export async function getAllOrders(): Promise<AdminOrder[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, order_number, status, total, placed_at, ship_full_name, ship_phone, order_items ( quantity )"
    )
    .order("placed_at", { ascending: false });

  if (error || !data) {
    if (error) logQueryError("getAllOrders", error.message);
    return [];
  }

  return (
    data as unknown as {
      id: string;
      order_number: string;
      status: OrderStatus;
      total: number;
      placed_at: string;
      ship_full_name: string;
      ship_phone: string;
      order_items: { quantity: number }[];
    }[]
  ).map((row) => ({
    id: row.id,
    orderNumber: row.order_number,
    status: row.status,
    total: row.total,
    placedAt: row.placed_at,
    customerName: row.ship_full_name,
    customerPhone: row.ship_phone,
    itemCount: row.order_items.reduce((sum, item) => sum + item.quantity, 0),
  }));
}
