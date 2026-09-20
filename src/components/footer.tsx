import Link from "next/link";
import { getCategories, getStoreSettings } from "@/lib/catalog";

/**
 * Hardcoded rather than read from store_settings, which has no column for it.
 * Worth moving into the database alongside the address and phone if a second
 * account ever needs listing.
 */
const INSTAGRAM_HANDLE = "_.teenage_mens_wear._";

export async function Footer() {
  // Both are cached for the request, so asking here costs nothing extra over
  // the layout and header already having asked.
  const [settings, categories] = await Promise.all([
    getStoreSettings(),
    getCategories(),
  ]);

  return (
    <footer className="border-t border-black/10 bg-zinc-50 dark:border-white/10 dark:bg-zinc-950">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          <FooterColumn title="Shop by">
            {categories.map((category) => (
              <FooterLink
                key={category.value}
                href={`/products?category=${category.value}`}
              >
                {category.label}
              </FooterLink>
            ))}
            <FooterLink href="/products">All products</FooterLink>
          </FooterColumn>

          <FooterColumn title="Help">
            <FooterLink href="/orders">Track your order</FooterLink>
            <FooterLink href="/account">Your account</FooterLink>
            <FooterLink href="/cart">Your cart</FooterLink>
          </FooterColumn>

          <FooterColumn title="Follow us">
            <li>
              <a
                href={`https://www.instagram.com/${INSTAGRAM_HANDLE}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-zinc-500 transition-colors hover:text-black dark:text-zinc-400 dark:hover:text-white"
              >
                <InstagramIcon />
                {INSTAGRAM_HANDLE}
              </a>
            </li>
          </FooterColumn>

        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-black/10 pt-8 dark:border-white/10">
          <span className="text-sm font-semibold">Payment methods</span>
          {/* The two the checkout actually offers — see the payment step in
              app/checkout/page.tsx. Nothing else is accepted, so nothing
              else is advertised. */}
          <div className="flex flex-wrap gap-2">
            <PaymentMethod>Cash on delivery</PaymentMethod>
            <PaymentMethod>UPI, card &amp; netbanking</PaymentMethod>
          </div>
        </div>

        <div className="mt-8 border-t border-black/10 pt-6 text-center text-sm text-zinc-500 dark:border-white/10 dark:text-zinc-400">
          <p>
            &copy; {new Date().getFullYear()} {settings.name}. All rights
            reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm font-semibold">{title}</span>
      <ul className="flex flex-col gap-2">{children}</ul>
    </div>
  );
}

function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className="text-sm text-zinc-500 transition-colors hover:text-black dark:text-zinc-400 dark:hover:text-white"
      >
        {children}
      </Link>
    </li>
  );
}

function InstagramIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      className="h-4 w-4 shrink-0"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function PaymentMethod({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-black/15 px-3 py-1 text-xs font-medium text-zinc-600 dark:border-white/20 dark:text-zinc-400">
      {children}
    </span>
  );
}
