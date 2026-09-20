"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useDialog } from "@/lib/use-dialog";
import { deleteProduct } from "@/app/admin/actions";

/**
 * Delete control for a product, with the confirmation in a modal dialog.
 *
 * Not window.confirm(): a native dialog blocks the page, cannot be styled to
 * match, and reads the bare question with none of the consequences spelled
 * out. This one says what is about to be destroyed and what survives.
 */
export function DeleteProductButton({
  productId,
  productName,
  /** Where to go afterwards. Staying put is right for a list row, which just
   *  refreshes; the edit page has to leave, since its record is gone. */
  redirectTo,
}: {
  productId: string;
  productName: string;
  redirectTo?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="font-medium text-red-600 underline-offset-2 hover:underline dark:text-red-400"
      >
        Delete
      </button>

      {/* Mounted only while open, so every open starts from a clean slate
          without a reset effect — the same shape as AuthModal. */}
      {open && (
        <ConfirmDeleteDialog
          productId={productId}
          productName={productName}
          redirectTo={redirectTo}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function ConfirmDeleteDialog({
  productId,
  productName,
  redirectTo,
  onClose,
}: {
  productId: string;
  productName: string;
  redirectTo?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus lands on Cancel, not Delete: the safe choice should be the one a
  // stray Enter or Space hits.
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  useDialog(onClose);

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteProduct(productId);
      if (!result.ok) {
        setError(result.error ?? "Could not delete.");
        return;
      }
      if (redirectTo) router.push(redirectTo);
      router.refresh();
      onClose();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={(event) => {
        // A misdirected click outside cancels; it must never delete.
        if (event.target === event.currentTarget && !pending) onClose();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-product-title"
        aria-describedby="delete-product-description"
        className="w-full max-w-sm rounded-t-2xl border border-black/10 bg-background p-6 text-left shadow-xl dark:border-white/15 sm:rounded-2xl"
      >
        <h2 id="delete-product-title" className="text-lg font-semibold">
          Delete {productName}?
        </h2>
        <p
          id="delete-product-description"
          className="mt-2 text-sm text-zinc-600 dark:text-zinc-400"
        >
          This removes the product for good, along with its sizes, images and
          reviews. Past orders keep their record of it. To take it off the
          storefront without losing it, hide it instead.
        </p>

        {error && (
          <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onClose}
            disabled={pending}
            className="flex h-11 items-center justify-center rounded-full border border-black/15 px-5 text-sm font-medium transition-colors hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            className="flex h-11 items-center justify-center rounded-full bg-red-600 px-5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Deleting..." : "Delete product"}
          </button>
        </div>
      </div>
    </div>
  );
}
