import { getCategoryOptions } from "@/lib/admin-catalog";
import { ProductForm } from "@/components/product-form";

export const metadata = { title: "Admin — New product" };

export default async function NewProductPage() {
  const categories = await getCategoryOptions();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Add product</h1>
      <ProductForm categories={categories} />
    </div>
  );
}
