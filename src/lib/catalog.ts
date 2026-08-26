/**
 * Catalog reads, backed by Supabase.
 *
 * Every function returns the same `Product` / category shapes the components
 * already consume, so pages swap their import and nothing else changes.
 *
 * Server-side only. Uses the session-less anon client so these pages stay
 * statically renderable; the catalog is world-readable under RLS, so no
 * session is needed to browse.
 */
import { cache } from "react";
import { getSupabaseAnonClient } from "./supabase/anon";
import type {
  CategoryRow,
  ProductReviewRow,
  ProductWithRelations,
  StoreSettingsRow,
} from "./supabase/database.types";
import type { Product, Review } from "./types";

/**
 * Columns needed to render a product, plus its category slug and sizes.
 *
 * `!inner` matters: without it, a filter on `categories.slug` does not restrict
 * the parent rows at all — PostgREST returns every product and merely nullifies
 * the embed, so category filtering silently returns the whole catalog. The join
 * is safe to make inner unconditionally because products.category_id is NOT NULL.
 */
const PRODUCT_SELECT = `
  id, slug, name, price, discount_percent, offer_price, description, image_path, featured, category_id,
  categories!inner ( slug, label ),
  product_variants ( size, sort_order, stock )
`;

/**
 * Thrown when the database is reachable but the schema is not there. Far more
 * useful than an empty storefront, which looks like "no products" rather than
 * "you forgot to run the migration".
 */
class CatalogUnavailableError extends Error {
  constructor(detail: string) {
    super(
      `Catalog query failed: ${detail}\n` +
        "If the tables do not exist yet, apply supabase/migrations/ " +
        "(see the Database section of README.md)."
    );
    this.name = "CatalogUnavailableError";
  }
}

function client() {
  const supabase = getSupabaseAnonClient();
  if (!supabase) {
    throw new CatalogUnavailableError(
      "Supabase is not configured — NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY missing"
    );
  }
  return supabase;
}

/** DB row -> the Product shape the components expect. */
function toProduct(row: ProductWithRelations): Product {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.categories?.slug ?? "",
    price: row.price,
    discountPercent: row.discount_percent,
    offerPrice: row.offer_price,
    description: row.description,
    // Sorted here rather than relying on the nested select's order, which
    // Postgres does not guarantee for embedded rows.
    sizes: [...row.product_variants]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((variant) => variant.size),
    image: row.image_path,
    featured: row.featured,
  };
}

// Wrapped in React's cache() because generateMetadata() and the RootLayout
// component both need this per request — without dedup that's two separate
// round-trips to Supabase for the same rows on every navigation.
export const getCategories = cache(async function getCategories(): Promise<
  { value: string; label: string }[]
> {
  const supabase = client();
  const { data, error } = await supabase
    .from("categories")
    .select("slug, label, sort_order")
    .order("sort_order");

  if (error) throw new CatalogUnavailableError(error.message);

  return (data as Pick<CategoryRow, "slug" | "label" | "sort_order">[]).map(
    (row) => ({ value: row.slug, label: row.label })
  );
});

export async function getProductsByCategory(
  category?: string
): Promise<Product[]> {
  const supabase = client();
  let query = supabase.from("products").select(PRODUCT_SELECT).order("name");

  // Filter on the joined category's slug so callers never deal in uuids.
  if (category) query = query.eq("categories.slug", category);

  const { data, error } = await query;
  if (error) throw new CatalogUnavailableError(error.message);

  return (data as unknown as ProductWithRelations[]).map(toProduct);
}

export async function getProductBySlug(
  slug: string
): Promise<Product | undefined> {
  const supabase = client();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new CatalogUnavailableError(error.message);
  if (!data) return undefined;

  return toProduct(data as unknown as ProductWithRelations);
}

export async function getFeaturedProducts(): Promise<Product[]> {
  const supabase = client();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("featured", true)
    .order("name");

  if (error) throw new CatalogUnavailableError(error.message);

  return (data as unknown as ProductWithRelations[]).map(toProduct);
}

/** All product slugs, for generateStaticParams. */
export async function getProductSlugs(): Promise<string[]> {
  const supabase = client();
  const { data, error } = await supabase.from("products").select("slug");

  if (error) throw new CatalogUnavailableError(error.message);
  return (data as { slug: string }[]).map((row) => row.slug);
}

// See getCategories() above for why this is cached: generateMetadata() and
// RootLayout both call it on every request.
export const getStoreSettings = cache(async function getStoreSettings(): Promise<StoreSettingsRow> {
  const supabase = client();
  const { data, error } = await supabase
    .from("store_settings")
    .select("name, short_name, tagline, address, phone_display, phone_href")
    .single();

  if (error) throw new CatalogUnavailableError(error.message);
  return data as StoreSettingsRow;
});

/** Newest first, like Amazon/Flipkart — reviewers want to see recent opinions. */
export async function getProductReviews(productId: string): Promise<Review[]> {
  const supabase = client();
  const { data, error } = await supabase
    .from("product_reviews")
    .select("id, product_id, user_id, reviewer_name, rating, comment, created_at, updated_at")
    .eq("product_id", productId)
    .order("created_at", { ascending: false });

  if (error) throw new CatalogUnavailableError(error.message);

  return (data as ProductReviewRow[]).map((row) => ({
    id: row.id,
    productId: row.product_id,
    userId: row.user_id,
    reviewerName: row.reviewer_name,
    rating: row.rating,
    comment: row.comment,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}
