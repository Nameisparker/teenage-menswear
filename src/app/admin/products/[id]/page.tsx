import { notFound } from "next/navigation";
import { getCategoryOptions, getProductById } from "@/lib/admin-catalog";
import { ProductForm } from "@/components/product-form";

export default async function EditProductPage(
  props: PageProps<"/admin/products/[id]">
) {
  const { id } = await props.params;
  const [product, categories] = await Promise.all([
    getProductById(id),
    getCategoryOptions(),
  ]);

  if (!product) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{product.name}</h1>
        <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
          {product.slug}
        </span>
      </div>
      <ProductForm product={product} categories={categories} />
    </div>
  );
}
