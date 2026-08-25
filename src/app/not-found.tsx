import Link from "next/link";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="max-w-md text-zinc-500 dark:text-zinc-400">
        That page doesn&apos;t exist — the product may have been retired, or the
        link may be mistyped.
      </p>
      <div className="flex flex-wrap gap-3 pt-2">
        <Link
          href="/products"
          className="flex h-12 items-center justify-center rounded-full bg-accent px-6 font-medium text-accent-foreground transition-opacity hover:opacity-90"
        >
          Browse products
        </Link>
        <Link
          href="/"
          className="flex h-12 items-center justify-center rounded-full border border-black/15 px-6 font-medium transition-colors hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
