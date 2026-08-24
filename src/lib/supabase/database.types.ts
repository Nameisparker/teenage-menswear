/**
 * Shapes of the rows this app reads and writes.
 *
 * Hand-maintained to match supabase/migrations/. Once the Supabase CLI is set
 * up you can replace this file with generated output:
 *
 *   supabase gen types typescript --project-id etcoozatxtprnigjuzuk > src/lib/supabase/database.types.ts
 *
 * Only the columns the app actually touches are modelled — this is a read/write
 * contract, not a full mirror of the schema.
 */

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "shipped"
  | "delivered"
  | "cancelled";

export type CategoryRow = {
  id: string;
  slug: string;
  label: string;
  sort_order: number;
};

export type ProductVariantRow = {
  size: string;
  sort_order: number;
  stock: number;
};

export type ProductRow = {
  id: string;
  slug: string;
  name: string;
  price: number;
  description: string;
  image_path: string;
  featured: boolean;
  category_id: string;
};

/** A product joined to its category slug and its size variants. */
export type ProductWithRelations = ProductRow & {
  categories: Pick<CategoryRow, "slug" | "label"> | null;
  product_variants: ProductVariantRow[];
};

export type StoreSettingsRow = {
  name: string;
  short_name: string;
  tagline: string;
  address: string;
  phone_display: string;
  phone_href: string;
};

export type ProfileRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
};

export type AddressRow = {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  line1: string;
  city: string;
  pin_code: string;
  is_default: boolean;
};

export type CartItemRow = {
  id: string;
  user_id: string;
  product_id: string;
  size: string;
  quantity: number;
};

export type OrderRow = {
  id: string;
  order_number: string;
  user_id: string;
  status: OrderStatus;
  ship_full_name: string;
  ship_phone: string;
  ship_email: string | null;
  ship_line1: string;
  ship_city: string;
  ship_pin_code: string;
  subtotal: number;
  total: number;
  placed_at: string;
};

export type OrderItemRow = {
  id: string;
  order_id: string;
  product_id: string | null;
  name: string;
  slug: string;
  size: string;
  unit_price: number;
  quantity: number;
  image_path: string;
};
