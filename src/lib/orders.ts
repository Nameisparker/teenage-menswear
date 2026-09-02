/**
 * Order reads for the signed-in customer, and for admins.
 *
 * These use the request-scoped (cookie-bound) client on purpose: orders are
 * per-user data, so the session must be attached and RLS does the filtering.
 * A customer sees only their own rows; an admin sees everything, via the
 * "Admins read all orders" policy. Neither is expressed here in application
 * code — the database decides.
 */
import "server-only";
import { getSupabaseServerClient } from "./supabase/server";
import type {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from "./supabase/database.types";

export type OrderLine = {
  name: string;
  slug: string;
  size: string;
  unitPrice: number;
  quantity: number;
  image: string;
};

export type OrderEvent = {
  status: OrderStatus;
  note: string | null;
  at: string;
};

export type Order = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  total: number;
  placedAt: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  shipTo: {
    fullName: string;
    phone: string;
    line1: string;
    city: string;
    pinCode: string;
  };
  lines: OrderLine[];
  events: OrderEvent[];
};

const ORDER_SELECT = `
  id, order_number, status, total, placed_at, payment_method, payment_status,
  ship_full_name, ship_phone, ship_line1, ship_city, ship_pin_code,
  order_items ( name, slug, size, unit_price, quantity, image_path ),
  order_events ( status, note, created_at )
`;

type OrderRowWithRelations = {
  id: string;
  order_number: string;
  status: OrderStatus;
  total: number;
  placed_at: string;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  ship_full_name: string;
  ship_phone: string;
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
  order_events: { status: OrderStatus; note: string | null; created_at: string }[];
};

function toOrder(row: OrderRowWithRelations): Order {
  return {
    id: row.id,
    orderNumber: row.order_number,
    status: row.status,
    total: row.total,
    placedAt: row.placed_at,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    shipTo: {
      fullName: row.ship_full_name,
      phone: row.ship_phone,
      line1: row.ship_line1,
      city: row.ship_city,
      pinCode: row.ship_pin_code,
    },
    lines: row.order_items.map((item) => ({
      name: item.name,
      slug: item.slug,
      size: item.size,
      unitPrice: item.unit_price,
      quantity: item.quantity,
      image: item.image_path,
    })),
    // Embedded rows come back unordered, so sort explicitly.
    events: [...row.order_events]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((event) => ({
        status: event.status,
        note: event.note,
        at: event.created_at,
      })),
  };
}

/** Orders visible to the caller, newest first. Empty when signed out. */
export async function getMyOrders(): Promise<Order[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .order("placed_at", { ascending: false });

  if (error || !data) return [];
  return (data as unknown as OrderRowWithRelations[]).map(toOrder);
}

/**
 * One order by its human-readable reference. Returns null when it does not
 * exist *or* is not the caller's — RLS makes those indistinguishable, which is
 * what we want: it avoids confirming that someone else's order number is real.
 */
export async function getOrderByNumber(
  orderNumber: string
): Promise<Order | null> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("order_number", orderNumber)
    .maybeSingle();

  if (error || !data) return null;
  return toOrder(data as unknown as OrderRowWithRelations);
}
