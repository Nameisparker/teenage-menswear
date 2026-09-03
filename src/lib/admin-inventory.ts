/**
 * The two reads behind the admin dashboard.
 *
 * Separate from admin-catalog.ts because it answers a different question: not
 * "what is this product" but "how much of it is left and how much has gone".
 * The counting itself is in inventory.ts, which is pure and tested.
 *
 * Both queries are unfiltered on purpose. The catalog is one shop's worth of
 * products and the aggregation is a couple of map lookups, so paging it would
 * add complexity to save nothing. If order_items ever grows past a few
 * thousand rows this is the read to move into a SQL view.
 */
import { getSupabaseServerClient } from "./supabase/server";
import {
  buildInventory,
  summariseInventory,
  type InventoryProduct,
  type InventorySummary,
  type SoldInput,
  type VariantInput,
} from "./inventory";
import type { OrderStatus } from "./supabase/database.types";

type VariantRow = {
  size: string;
  sort_order: number;
  stock: number;
  products: {
    id: string;
    name: string;
    slug: string;
    is_active: boolean;
    categories: { slug: string } | null;
  } | null;
};

type SoldRow = {
  product_id: string | null;
  size: string;
  quantity: number;
  orders: { status: OrderStatus } | null;
};

export type Inventory = {
  products: InventoryProduct[];
  summary: InventorySummary;
};

const EMPTY: Inventory = {
  products: [],
  summary: {
    products: 0,
    hiddenProducts: 0,
    soldOutProducts: 0,
    unitsInStock: 0,
    unitsSold: 0,
    sizesOut: 0,
    sizesLow: 0,
  },
};

export async function getInventory(): Promise<Inventory> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return EMPTY;

  // Both at once: they are independent, and running them in series would make
  // the dashboard wait for two round-trips instead of one.
  const [variants, sold] = await Promise.all([
    supabase
      .from("product_variants")
      .select(
        "size, sort_order, stock, products!inner ( id, name, slug, is_active, categories!inner ( slug ) )"
      ),
    supabase
      .from("order_items")
      .select("product_id, size, quantity, orders!inner ( status )"),
  ]);

  if (variants.error || sold.error) {
    console.error(
      "getInventory:",
      variants.error?.message ?? sold.error?.message
    );
    return EMPTY;
  }

  const variantInputs: VariantInput[] = (
    variants.data as unknown as VariantRow[]
  )
    // products is NOT NULL through the inner join; stay defensive so one odd
    // row cannot blank the whole dashboard.
    .filter((row) => row.products)
    .map((row) => ({
      productId: row.products!.id,
      productName: row.products!.name,
      slug: row.products!.slug,
      categorySlug: row.products!.categories?.slug ?? "",
      isActive: row.products!.is_active,
      size: row.size,
      sortOrder: row.sort_order,
      stock: row.stock,
    }));

  const soldInputs: SoldInput[] = (sold.data as unknown as SoldRow[])
    .filter((row) => row.orders)
    .map((row) => ({
      productId: row.product_id,
      size: row.size,
      quantity: row.quantity,
      orderStatus: row.orders!.status,
    }));

  const products = buildInventory(variantInputs, soldInputs);
  return { products, summary: summariseInventory(products) };
}
