"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { StarRatingInput } from "./star-rating";

type OwnReview = { rating: number; comment: string } | null;

/**
 * Write or edit your own review for this product.
 *
 * Runs entirely client-side: the product page stays statically rendered (see
 * ProductPage's revalidate), so it never knows who is signed in. This
 * component reads/writes through the browser Supabase client instead, the
 * same way AddToCartButton and CartProvider handle customer-owned writes.
 */
export function ReviewForm({ productId }: { productId: string }) {
  const router = useRouter();
  const { user, loading: authLoading, configured, openAuth } = useAuth();

  const [own, setOwn] = useState<OwnReview>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [fetchedFor, setFetchedFor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Pull the caller's existing review (if any) so editing it doesn't start
  // from a blank form.
  useEffect(() => {
    // Nothing to fetch when signed out — the component renders the sign-in
    // prompt in that case regardless of any stale `own`/`fetchedFor` from a
    // previous session, so there is nothing to reset here either.
    if (!user) return;

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    let cancelled = false;
    void supabase
      .from("product_reviews")
      .select("rating, comment")
      .eq("product_id", productId)
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const existing = data as OwnReview;
        setOwn(existing);
        setRating(existing?.rating ?? 0);
        setComment(existing?.comment ?? "");
        setFetchedFor(user.id);
      });

    return () => {
      cancelled = true;
    };
  }, [user, productId]);

  if (!configured || authLoading) return null;

  if (!user) {
    return (
      <button
        type="button"
        onClick={openAuth}
        className="text-sm font-medium text-accent underline-offset-2 hover:underline"
      >
        Sign in to write a review
      </button>
    );
  }

  // Own review is still loading — avoid flashing an empty form that then
  // jumps to pre-filled once the fetch above lands.
  if (fetchedFor !== user.id) return null;

  async function handleSubmit() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user) return;
    if (rating < 1) {
      setError("Pick a star rating first.");
      return;
    }

    setBusy(true);
    setError(null);

    const { error: writeError } = await supabase
      .from("product_reviews")
      .upsert(
        { product_id: productId, user_id: user.id, rating, comment: comment.trim() },
        { onConflict: "product_id,user_id" }
      );

    setBusy(false);

    if (writeError) {
      setError(writeError.message);
      return;
    }

    setOwn({ rating, comment: comment.trim() });
    setSaved(true);
    router.refresh();
  }

  async function handleDelete() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user) return;

    setBusy(true);
    setError(null);

    const { error: deleteError } = await supabase
      .from("product_reviews")
      .delete()
      .eq("product_id", productId)
      .eq("user_id", user.id);

    setBusy(false);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setOwn(null);
    setRating(0);
    setComment("");
    setSaved(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-black/10 p-4 dark:border-white/10">
      <span className="text-sm font-medium">
        {own ? "Your review" : "Write a review"}
      </span>

      <StarRatingInput value={rating} onChange={setRating} />

      <textarea
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        placeholder="What did you think of this product?"
        rows={3}
        className="w-full resize-none rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm placeholder:text-zinc-400 dark:border-white/20"
      />

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleSubmit()}
          className="h-9 rounded-full bg-accent px-4 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "Saving…" : own ? "Update review" : "Submit review"}
        </button>

        {own && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleDelete()}
            className="text-sm text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400 disabled:opacity-60"
          >
            Delete
          </button>
        )}

        {saved && !busy && (
          <span className="text-sm text-zinc-500 dark:text-zinc-400">Saved.</span>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
