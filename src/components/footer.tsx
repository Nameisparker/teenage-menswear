import Link from "next/link";
import { getCategories, getStoreSettings } from "@/lib/catalog";

export async function Footer() {
  const [CATEGORIES, settings] = await Promise.all([
    getCategories(),
    getStoreSettings(),
  ]);

  // Same shape the markup already used.
  const STORE = {
    name: settings.name,
    tagline: settings.tagline,
    address: settings.address,
    phoneHref: settings.phone_href,
    phoneDisplay: settings.phone_display,
  };

  return (
    <footer className="border-t border-black/10 bg-zinc-50 dark:border-white/10 dark:bg-zinc-950">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-3">
          <div className="flex flex-col gap-3">
            <span className="text-lg font-bold tracking-tight">
              {STORE.name}
            </span>
            <p className="max-w-xs text-sm text-zinc-500 dark:text-zinc-400">
              {STORE.tagline} Shirts, pants, tees, and accessories built for
              everyday wear.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <span className="text-sm font-semibold">Shop</span>
            <nav className="flex flex-col gap-2 text-sm text-zinc-500 dark:text-zinc-400">
              {CATEGORIES.map((category) => (
                <Link
                  key={category.value}
                  href={`/products?category=${category.value}`}
                  className="transition-colors hover:text-black dark:hover:text-white"
                >
                  {category.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex flex-col gap-3">
            <span className="text-sm font-semibold">Visit our store</span>
            <address className="flex flex-col gap-2 text-sm text-zinc-500 not-italic dark:text-zinc-400">
              <span>{STORE.address}</span>
              <a
                href={STORE.phoneHref}
                className="transition-colors hover:text-black dark:hover:text-white"
              >
                {STORE.phoneDisplay}
              </a>
            </address>
          </div>
        </div>

        <div className="mt-10 border-t border-black/10 pt-6 text-sm text-zinc-500 dark:border-white/10 dark:text-zinc-400">
          <p>
            &copy; {new Date().getFullYear()} {STORE.name}. All rights
            reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
