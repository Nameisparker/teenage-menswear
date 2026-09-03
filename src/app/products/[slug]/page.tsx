import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCategories,
  getProductBySlug,
  getProductReviews,
  getProductSlugs,
  getRelatedProducts,
} from "@/lib/catalog";
import { SITE_URL } from "@/lib/site";
import { Price } from "@/components/price";
import { ProductGallery } from "@/components/product-gallery";
import { ProductCard } from "@/components/product-card";
import { ProductInfo } from "@/components/product-info";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { ReviewsSection } from "@/components/reviews/reviews-section";
import { StarRatingDisplay } from "@/components/reviews/star-rating";

export const revalidate = 60;

export async function generateStaticParams() {
  const slugs = await getProductSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata(props: PageProps<"/products/[slug]">) {
  const { slug } = await props.params;
  const product = await getProductBySlug(slug);

  // The store name comes from the title template in the root layout, so it
  // must not be appended again here. This also drops a second query that ran
  // on every product page purely to spell out the shop’s own name.
  if (!product) return { title: "Product not found" };

  const description =
    product.description.slice(0, 200) || `${product.name} at ${SITE_URL}`;

  return {
    title: product.name,
    description,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      type: "website",
      title: product.name,
      description,
      url: `/products/${product.slug}`,
      images: [{ url: product.image }],
    },
  };
}

export default async function ProductPage(props: PageProps<"/products/[slug]">) {
  const { slug } = await props.params;
  const product = await getProductBySlug(slug);

  if (!product) notFound();

  // Independent of each other, so they overlap rather than queue up three
  // round-trips in series before the page can render.
  const [reviews, related, categories] = await Promise.all([
    getProductReviews(product.id),
    getRelatedProducts(product.category, product.id),
    getCategories(),
  ]);

  const categoryLabel = categories.find(
    (category) => category.value === product.category
  )?.label;

  const averageRating = reviews.length
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    : 0;

  return (
    <>
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 sm:grid-cols-2">
        <ProductGallery images={product.images} name={product.name} />

        <div className="flex flex-col gap-6">
          <div className="flex flex-col items-start">
            {categoryLabel && (
              <Link
                href={`/products?category=${product.category}`}
                className="text-xs font-semibold tracking-wide text-accent uppercase hover:underline"
              >
                {categoryLabel}
              </Link>
            )}
            <h1 className="mt-1 text-2xl font-semibold">{product.name}</h1>

            {/* Anchors to the reviews below rather than repeating them —
                shoppers look for the star line before anything else. */}
            {reviews.length > 0 && (
              <a
                href="#reviews"
                className="mt-2 flex items-center gap-2 text-sm text-zinc-500 hover:underline dark:text-zinc-400"
              >
                <StarRatingDisplay value={averageRating} size="sm" />
                <span>
                  {averageRating.toFixed(1)} · {reviews.length} review
                  {reviews.length === 1 ? "" : "s"}
                </span>
              </a>
            )}

            {/* Price renders an inline span, so it needs a block wrapper here:
                on its own it would flow onto the star line and ignore its
                own top margin. */}
            <div className="mt-3">
              <Price
                price={product.price}
                offerPrice={product.offerPrice}
                discountPercent={product.discountPercent}
                size="lg"
              />
            </div>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Inclusive of all taxes
            </p>
          </div>

          <AddToCartButton product={product} />

          <ProductInfo product={product} categoryLabel={categoryLabel} />
        </div>
      </div>

      {related.length > 0 && (
        <section className="mx-auto max-w-6xl border-t border-black/10 px-4 py-12 sm:px-6 dark:border-white/10">
          <div className="mb-6 flex items-baseline justify-between gap-4">
            <h2 className="text-xl font-semibold">You may also like</h2>
            {categoryLabel && (
              <Link
                href={`/products?category=${product.category}`}
                className="text-sm font-medium text-accent hover:underline"
              >
                All {categoryLabel.toLowerCase()}
              </Link>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}

      <div id="reviews">
        <ReviewsSection productId={product.id} reviews={reviews} />
      </div>
    </>
  );
}
