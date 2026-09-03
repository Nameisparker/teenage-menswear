/**
 * Catalog reads for the admin screens.
 *
 * Separate from src/lib/catalog.ts because these must use the session-bound
 * client: admins see inactive products, which the public policy hides, and that
 * only works when the request carries the admin's session.
 */
import { getSupabaseServerClient } from "./supabase/server";
import type {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from "./supabase/database.types";

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

export type AdminOrderLine = {
  name: string;
  slug: string;
  size: string;
  /** What was charged per unit at purchase time, discounts already applied. */
  unitPrice: number;
  quantity: number;
  image: string;
};

export type AdminOrderEvent = {
  status: OrderStatus;
  note: string | null;
  at: string;
};

export type AdminOrder = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  /** Razorpay's own ids, for reconciling a payment against their dashboard. */
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  paidAt: string | null;
  /** Why the last attempt failed, in Razorpay's words. Null for COD. */
  paymentError: string | null;
  /** List-price sum. Greater than total when something was discounted. */
  subtotal: number;
  total: number;
  placedAt: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  /** Units, not lines — two of one size counts as two. */
  itemCount: number;
  lines: AdminOrderLine[];
};

export type AdminOrderDetail = AdminOrder & {
  shipTo: { line1: string; city: string; pinCode: string };
  events: AdminOrderEvent[];
};

/**
 * Line items are pulled with the order rather than on demand. An order is not
 * actionable without them: the whole point of the admin list is deciding what
 * to pack, and a row that only says "3 items" cannot answer that.
 */
const ADMIN_ORDER_SELECT = `
  id, order_number, status, subtotal, total, placed_at,
  payment_method, payment_status,
  razorpay_order_id, razorpay_payment_id, paid_at, payment_error,
  ship_full_name, ship_phone, ship_email, ship_line1, ship_city, ship_pin_code,
  order_items ( name, slug, size, unit_price, quantity, image_path )
`;

type AdminOrderRow = {
  id: string;
  order_number: string;
  status: OrderStatus;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  paid_at: string | null;
  payment_error: string | null;
  subtotal: number;
  total: number;
  placed_at: string;
  ship_full_name: string;
  ship_phone: string;
  ship_email: string | null;
  ship_line1: string;
  ship_city: string;
  ship_pin_code: string;
  order_items: {
    name: string;
    slug: string;
    size: string;
    unit_price: number;
    quantity: number;
    image_path: string;
  }[];
  order_events?: { status: OrderStatus; note: string | null; created_at: string }[];
};

function toAdminOrder(row: AdminOrderRow): AdminOrder {
  const lines = row.order_items.map((item) => ({
    name: item.name,
    slug: item.slug,
    size: item.size,
    unitPrice: item.unit_price,
    quantity: item.quantity,
    image: item.image_path,
  }));

  return {
    id: row.id,
    orderNumber: row.order_number,
    status: row.status,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    razorpayOrderId: row.razorpay_order_id,
    razorpayPaymentId: row.razorpay_payment_id,
    paidAt: row.paid_at,
    paymentError: row.payment_error,
    subtotal: row.subtotal,
    total: row.total,
    placedAt: row.placed_at,
    customerName: row.ship_full_name,
    customerPhone: row.ship_phone,
    customerEmail: row.ship_email,
    itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    lines,
  };
}

/** Every order, newest first. Visible only to admins, via RLS. */
export async function getAllOrders(): Promise<AdminOrder[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("orders")
    .select(ADMIN_ORDER_SELECT)
    .order("placed_at", { ascending: false });

  if (error || !data) {
    if (error) logQueryError("getAllOrders", error.message);
    return [];
  }

  return (data as unknown as AdminOrderRow[]).map(toAdminOrder);
}

/**
 * One order in full, by its human-readable reference. Returns null when it does
 * not exist — RLS already restricts this to admins, so there is no separate
 * ownership check to make here.
 */
export async function getAdminOrderByNumber(
  orderNumber: string
): Promise<AdminOrderDetail | null> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("orders")
    .select(
      `${ADMIN_ORDER_SELECT}, order_events ( status, note, created_at )`
    )
    .eq("order_number", orderNumber)
    .maybeSingle();

  if (error || !data) {
    if (error) logQueryError("getAdminOrderByNumber", error.message);
    return null;
  }

  const row = data as unknown as AdminOrderRow;

  return {
    ...toAdminOrder(row),
    shipTo: {
      line1: row.ship_line1,
      city: row.ship_city,
      pinCode: row.ship_pin_code,
    },
    // Embedded rows come back unordered, so sort explicitly.
    events: [...(row.order_events ?? [])]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((event) => ({
        status: event.status,
        note: event.note,
        at: event.created_at,
      })),
  };
}
