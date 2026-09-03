import { notFound } from "next/navigation";
import { getCategoryOptions, getProductById } from "@/lib/admin-catalog";
import { ProductForm } from "@/components/product-form";
import { GalleryEditor } from "@/components/gallery-editor";

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
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {product.slug}
        </span>
      </div>

      {/* The gallery renders inside the form so it reads in order — image,
          then the other angles — while the form's save row stays the last
          thing on the page. Its own add/remove still apply immediately; a
          file cannot be half-uploaded and waiting for a save. */}
      <ProductForm product={product} categories={categories}>
        <GalleryEditor product={product} />
      </ProductForm>
    </div>
  );
}
