"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/context/cart-context";
import { displayNameFor, useAuth } from "@/context/auth-context";

/** Categories are fetched by the layout (a Server Component) and passed in,
 * since this component is client-side and cannot query the database itself. */
export function Header({
  categories,
  storeName,
}: {
  categories: { value: string; label: string }[];
  storeName: string;
}) {
  const { totalItems } = useCart();
  const { user, loading, openAuth, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  // The wordmark stacks the first word over the rest ("Teenage Menswear" ->
  // TEENAGE / MENSWEAR). A single-word store name just renders one line.
  const [firstWord, ...restWords] = storeName.split(" ");
  const secondLine = restWords.join(" ");

  return (
    <header className="sticky top-0 z-10 border-b border-black/10 bg-white/90 backdrop-blur dark:border-white/10 dark:bg-black/90">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-black/15 dark:border-white/20 sm:hidden"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>

          <Link href="/" className="flex flex-col leading-none">
            <span className="text-lg font-bold tracking-tight">
              {firstWord.toUpperCase()}
            </span>
            {secondLine && (
              <span className="text-[10px] font-medium tracking-[0.25em] text-accent">
                {secondLine.toUpperCase()}
              </span>
            )}
          </Link>
        </div>

        <nav className="hidden gap-8 text-sm font-medium sm:flex">
          {categories.map((category) => (
            <Link
              key={category.value}
              href={`/products?category=${category.value}`}
              className="text-zinc-600 transition-colors hover:text-black dark:text-zinc-400 dark:hover:text-white"
            >
              {category.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4 sm:gap-5">
          {!loading &&
            (user ? (
              <div className="flex items-center gap-2 text-sm">
                <span
                  className="hidden max-w-[10rem] truncate font-medium sm:inline"
                  title={displayNameFor(user)}
                >
                  {displayNameFor(user)}
                </span>
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="text-zinc-600 underline-offset-2 transition-colors hover:text-black hover:underline dark:text-zinc-400 dark:hover:text-white"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={openAuth}
                className="text-sm font-medium text-zinc-600 transition-colors hover:text-black dark:text-zinc-400 dark:hover:text-white"
              >
                Sign in
              </button>
            ))}

          <Link
            href="/cart"
            className="relative flex items-center gap-2 text-sm font-medium"
          >
            Cart
            {totalItems > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-xs text-accent-foreground">
                {totalItems}
              </span>
            )}
          </Link>
        </div>
      </div>

      {menuOpen && (
        <nav
          data-mobile-menu="true"
          className="flex flex-col gap-1 border-t border-black/10 px-4 py-3 text-sm font-medium dark:border-white/10 sm:hidden"
        >
          {categories.map((category) => (
            <Link
              key={category.value}
              href={`/products?category=${category.value}`}
              onClick={() => setMenuOpen(false)}
              className="rounded-md px-2 py-2 text-zinc-600 transition-colors hover:bg-black/5 hover:text-black dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white"
            >
              {category.label}
            </Link>
          ))}
          <Link
            href="/products"
            onClick={() => setMenuOpen(false)}
            className="rounded-md px-2 py-2 font-semibold text-accent transition-colors hover:bg-black/5 dark:hover:bg-white/10"
          >
            All Products
          </Link>
        </nav>
      )}
    </header>
  );
}

function MenuIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}
