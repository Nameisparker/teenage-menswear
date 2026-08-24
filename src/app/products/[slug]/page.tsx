import { notFound } from "next/navigation";
import { PRODUCTS, getProductBySlug } from "@/lib/products";
import { formatPrice } from "@/lib/format";
import { ProductImage } from "@/components/product-image";
import { AddToCartButton } from "@/components/add-to-cart-button";

export function generateStaticParams() {
  return PRODUCTS.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata(props: PageProps<"/products/[slug]">) {
  const { slug } = await props.params;
  const product = getProductBySlug(slug);
  return { title: product ? `${product.name} — THREAD` : "Product not found" };
}

export default async function ProductPage(props: PageProps<"/products/[slug]">) {
  const { slug } = await props.params;
  const product = getProductBySlug(slug);

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
          <p className="mt-1 text-lg text-zinc-500 dark:text-zinc-400">
            {formatPrice(product.price)}
          </p>
        </div>

        <p className="text-zinc-600 dark:text-zinc-400">
          {product.description}
        </p>

        <AddToCartButton product={product} />
      </div>
    </div>
  );
}
