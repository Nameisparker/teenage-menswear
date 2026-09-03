"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveProduct, setProductActive } from "@/app/admin/actions";
import { ImageUploadField } from "@/components/image-upload-field";
import { LOW_STOCK } from "@/lib/inventory";
import type { AdminProduct } from "@/lib/admin-catalog";

/** Snapshot of every field, for telling "edited" from "opened and left alone". */
function snapshot(form: HTMLFormElement): string {
  return JSON.stringify([...new FormData(form).entries()]);
}

/**
 * Create/edit form for a product. Submits to a Server Action, so the write
 * happens with the admin's session and RLS authorises it.
 *
 * Everything the product owns — fields, image, and the stock behind each size —
 * is one form with one save at the end. It used to be three: the form, a
 * per-size Save button, and a separate stock screen. Three save buttons on one
 * page is three chances to change something and walk away thinking it stuck.
 *
 * `children` renders inside the form, before the save row, so the gallery
 * editor can sit in the natural reading order and the save button is still the
 * last thing on the page.
 */
export function ProductForm({
  product,
  categories,
  children,
}: {
  product?: AdminProduct;
  categories: { id: string; slug: string; label: string }[];
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  // What the form looked like when it was opened, or when it was last saved.
  const cleanRef = useRef<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const editing = Boolean(product);

  /**
   * Recomputed from the whole form rather than tracked per field, so undoing an
   * edit by hand puts the button back to "No changes" instead of leaving the
   * page permanently claiming to be dirty.
   */
  function checkDirty(form: HTMLFormElement) {
    cleanRef.current ??= snapshot(form);
    setDirty(snapshot(form) !== cleanRef.current);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      const result = await saveProduct(formData);
      if (!result.ok) {
        setError(result.error ?? "Could not save.");
        return;
      }
      setError(null);
      setSaved(true);

      if (!editing) {
        router.push("/admin/products");
        return;
      }

      // Stay put on an edit. The admin is mid-task — restocking sizes, fixing a
      // price — and being thrown back to the list after every save is how you
      // lose your place in a 40-product catalog.
      cleanRef.current = snapshot(form);
      setDirty(false);
      router.refresh();
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
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      // Both events: `input` catches typing, `change` catches the select, the
      // checkboxes and the number steppers.
      onInput={(event) => checkDirty(event.currentTarget)}
      onChange={(event) => checkDirty(event.currentTarget)}
      className="flex max-w-2xl flex-col gap-4"
    >
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
        label="Image"
        hint="Uploaded to the product-images bucket. Replacing one keeps the old file, so a live product never loses its picture mid-edit."
      >
        <ImageUploadField defaultValue={product?.imagePath} />
      </Field>

      {children}

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

      {product && product.variants.length > 0 && (
        <StockFields variants={product.variants} />
      )}

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

      {/* Sticky only while there is something to lose: an unsaved change should
          follow you down the page, and a bar pinned there permanently just
          covers content. */}
      <div
        className={`flex flex-wrap items-center gap-4 pt-2 ${
          dirty || pending
            ? "sticky bottom-0 z-10 -mx-4 border-t border-black/10 bg-background px-4 pb-4 dark:border-white/10"
            : ""
        }`}
      >
        <button
          type="submit"
          disabled={pending || (editing && !dirty)}
          className="flex h-12 items-center justify-center rounded-full bg-accent px-6 font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending
            ? "Saving…"
            : editing
              ? dirty
                ? "Save changes"
                : "No changes"
              : "Create product"}
        </button>

        {editing && (
          <span
            aria-live="polite"
            className={`text-sm ${
              dirty
                ? "text-amber-700 dark:text-amber-500"
                : "text-zinc-500 dark:text-zinc-400"
            }`}
          >
            {dirty
              ? "Unsaved changes"
              : saved
                ? "Saved."
                : "Everything is saved."}
          </span>
        )}

        {product && (
          <button
            type="button"
            onClick={handleToggleActive}
            disabled={pending}
            className="ml-auto text-sm font-medium text-zinc-600 underline-offset-2 hover:underline disabled:opacity-60 dark:text-zinc-400"
          >
            {product.isActive ? "Hide from storefront" : "Show on storefront"}
          </button>
        )}
      </div>
    </form>
  );
}

/**
 * Units left, per size — part of the form rather than its own saved widget.
 *
 * Sizes themselves are still edited in the Sizes field above; this only moves
 * the numbers. A size added in the same save starts at zero and gets its own
 * box once the page reloads.
 */
function StockFields({
  variants,
}: {
  variants: { size: string; stock: number }[];
}) {
  const total = variants.reduce((sum, variant) => sum + variant.stock, 0);
  const out = variants.filter((variant) => variant.stock === 0).length;

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium">Stock</legend>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        {total} unit{total === 1 ? "" : "s"} across {variants.length} size
        {variants.length === 1 ? "" : "s"}
        {out > 0 && ` · ${out} sold out`}. A size at zero cannot be bought.
      </p>

      <ul className="flex flex-col divide-y divide-black/5 dark:divide-white/5">
        {variants.map((variant) => (
          <li
            key={variant.size}
            className="flex items-center gap-3 py-2 text-sm"
          >
            <label className="w-16 font-medium" htmlFor={`stock-${variant.size}`}>
              {variant.size}
            </label>
            <input
              id={`stock-${variant.size}`}
              name={`stock:${variant.size}`}
              type="number"
              min={0}
              step={1}
              defaultValue={variant.stock}
              className="w-24 rounded-md border border-black/15 bg-transparent px-2 py-1.5 dark:border-white/20"
            />
            {variant.stock === 0 ? (
              <span className="rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-xs font-semibold text-red-800 dark:text-red-200">
                Sold out
              </span>
            ) : (
              variant.stock <= LOW_STOCK && (
                <span className="text-xs font-medium text-amber-700 dark:text-amber-500">
                  Low
                </span>
              )
            )}
          </li>
        ))}
      </ul>
    </fieldset>
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
