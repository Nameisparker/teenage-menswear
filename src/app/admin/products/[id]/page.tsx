import { notFound } from "next/navigation";
import { getCategoryOptions, getProductById } from "@/lib/admin-catalog";
import { ProductForm } from "@/components/product-form";
import { GalleryEditor } from "@/components/gallery-editor";
import { DeleteProductButton } from "@/components/delete-product-button";

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

      {/* Below the form, not in it: a destructive action does not belong next
          to Save, where a misread click costs a product. */}
      <div className="flex max-w-2xl flex-col gap-2 border-t border-black/10 pt-6 dark:border-white/10">
        <span className="text-sm font-semibold">Delete this product</span>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Removes it from the catalog for good, along with its sizes, images
          and reviews. Past orders keep their record of it. To take it off the
          storefront without losing it, hide it instead.
        </p>
        <div className="pt-1">
          <DeleteProductButton
            productId={product.id}
            productName={product.name}
            redirectTo="/admin/products"
          />
        </div>
      </div>
    </div>
  );
}
