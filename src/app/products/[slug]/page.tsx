import { notFound } from "next/navigation";
import { getProductBySlug, getProductReviews, getProductSlugs } from "@/lib/catalog";
import { SITE_URL } from "@/lib/site";
import { Price } from "@/components/price";
import { ProductImage } from "@/components/product-image";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { ReviewsSection } from "@/components/reviews/reviews-section";

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

  const reviews = await getProductReviews(product.id);

  return (
    <>
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 sm:grid-cols-2">
        <ProductImage
          image={product.image}
          name={product.name}
          className="aspect-square w-full rounded-lg"
          sizes="(min-width: 640px) 50vw, 100vw"
          priority
        />

        <div className="flex flex-col gap-6">
          <div>
            <h1 className="text-2xl font-semibold">{product.name}</h1>
            <Price
              price={product.price}
              offerPrice={product.offerPrice}
              discountPercent={product.discountPercent}
              size="lg"
              className="mt-2"
            />
          </div>

          <p className="text-zinc-600 dark:text-zinc-400">
            {product.description}
          </p>

          <AddToCartButton product={product} />
        </div>
      </div>

      <ReviewsSection productId={product.id} reviews={reviews} />
    </>
  );
}
