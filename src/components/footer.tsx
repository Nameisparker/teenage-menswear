import Image from "next/image";
import { getStoreSettings } from "@/lib/catalog";

export async function Footer() {
  const settings = await getStoreSettings();

  return (
    <footer className="border-t border-black/10 bg-zinc-50 dark:border-white/10 dark:bg-zinc-950">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            {/* The name beside it carries the branding, so the mark is
                decorative and stays out of the accessibility tree. */}
            <Image
              src="/logo.png"
              alt=""
              width={128}
              height={108}
              className="h-11 w-auto"
            />
            <span className="text-lg font-bold tracking-tight">
              {settings.name}
            </span>
          </div>
          <p className="max-w-xs text-sm text-zinc-500 dark:text-zinc-400">
            {settings.tagline} Shirts, pants, tees, and accessories built for
            everyday wear.
          </p>
        </div>

        <div className="mt-10 border-t border-black/10 pt-6 text-sm text-zinc-500 dark:border-white/10 dark:text-zinc-400">
          <p>
            &copy; {new Date().getFullYear()} {settings.name}. All rights
            reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
