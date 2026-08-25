import { notFound } from "next/navigation";
import { getProductBySlug, getProductSlugs, getStoreSettings } from "@/lib/catalog";
import { Price } from "@/components/price";
import { ProductImage } from "@/components/product-image";
import { AddToCartButton } from "@/components/add-to-cart-button";

export const revalidate = 60;

export async function generateStaticParams() {
  const slugs = await getProductSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata(props: PageProps<"/products/[slug]">) {
  const { slug } = await props.params;
  const [product, store] = await Promise.all([
    getProductBySlug(slug),
    getStoreSettings(),
  ]);
  return {
    title: product ? `${product.name} — ${store.name}` : "Product not found",
  };
}

export default async function ProductPage(props: PageProps<"/products/[slug]">) {
  const { slug } = await props.params;
  const product = await getProductBySlug(slug);

  if (!product) notFound();

  return (
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
  );
}
