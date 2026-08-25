"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveProduct, setProductActive } from "@/app/admin/actions";
import type { AdminProduct } from "@/lib/admin-catalog";

/**
 * Create/edit form for a product. Submits to a Server Action, so the write
 * happens with the admin's session and RLS authorises it.
 */
export function ProductForm({
  product,
  categories,
}: {
  product?: AdminProduct;
  categories: { id: string; slug: string; label: string }[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const editing = Boolean(product);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await saveProduct(formData);
      if (!result.ok) {
        setError(result.error ?? "Could not save.");
        return;
      }
      setError(null);
      setSaved(true);
      router.push("/admin/products");
    });
  }

  function handleToggleActive() {
    if (!product) return;
    startTransition(async () => {
      const result = await setProductActive(product.id, !product.isActive);
      if (!result.ok) {
        setError(result.error ?? "Could not update.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-4">
      {product && <input type="hidden" name="id" value={product.id} />}

      {/* Without this the category select is just a dead "Choose…" and the
          form cannot be submitted, with nothing on screen explaining why. */}
      {categories.length === 0 && (
        <p
          role="alert"
          className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300"
        >
          No categories could be loaded, so this product cannot be saved. Reload
          the page; if it persists, check the database connection.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <input
            required
            name="name"
            defaultValue={product?.name}
            className={inputClass}
          />
        </Field>

        <Field
          label="Slug"
          hint="Leave blank to generate from the name. Used in the URL."
        >
          <input
            name="slug"
            defaultValue={product?.slug}
            placeholder="auto-generated"
            className={inputClass}
          />
        </Field>

        <Field label="Category">
          <select
            required
            name="categoryId"
            defaultValue={product?.categoryId ?? ""}
            className={inputClass}
          >
            <option value="" disabled>
              Choose…
            </option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Price (whole rupees)">
          <input
            required
            name="price"
            type="number"
            min={1}
            step={1}
            defaultValue={product?.price}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Description">
        <textarea
          name="description"
          rows={3}
          defaultValue={product?.description}
          className={inputClass}
        />
      </Field>

      <Field
        label="Image path"
        hint="A file under /public, e.g. /products/shirts/shirt_01.jpg"
      >
        <input
          required
          name="imagePath"
          defaultValue={product?.imagePath}
          placeholder="/products/shirts/shirt_01.jpg"
          className={inputClass}
        />
      </Field>

      <Field
        label="Sizes"
        hint="Comma separated, in the order they should appear. e.g. S, M, L, XL, XXL"
      >
        <input
          required
          name="sizes"
          defaultValue={product?.sizes.join(", ")}
          placeholder="S, M, L, XL, XXL"
          className={inputClass}
        />
      </Field>

      <div className="flex flex-wrap gap-6 pt-1">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            name="featured"
            defaultChecked={product?.featured ?? false}
            className="h-4 w-4"
          />
          Featured on the home page
        </label>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={product?.isActive ?? true}
            className="h-4 w-4"
          />
          Visible on the storefront
        </label>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      {saved && !error && (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">Saved.</p>
      )}

      <div className="flex flex-wrap items-center gap-4 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="flex h-12 items-center justify-center rounded-full bg-accent px-6 font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Saving…" : editing ? "Save changes" : "Create product"}
        </button>

        {product && (
          <button
            type="button"
            onClick={handleToggleActive}
            disabled={pending}
            className="text-sm font-medium text-zinc-600 underline-offset-2 hover:underline disabled:opacity-60 dark:text-zinc-400"
          >
            {product.isActive
              ? "Hide from storefront"
              : "Show on storefront"}
          </button>
        )}
      </div>
    </form>
  );
}

const inputClass =
  "rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/20";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      {children}
      {hint && (
        <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
          {hint}
        </span>
      )}
    </label>
  );
}
