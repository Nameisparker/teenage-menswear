"use client";

import { useState } from "react";
import Link from "next/link";
import { CATEGORIES } from "@/lib/products";
import { useCart } from "@/context/cart-context";

export function Header() {
  const { totalItems } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);

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
            <span className="text-lg font-bold tracking-tight">TEENAGE</span>
            <span className="text-[10px] font-medium tracking-[0.25em] text-accent">
              MENSWEAR
            </span>
          </Link>
        </div>

        <nav className="hidden gap-8 text-sm font-medium sm:flex">
          {CATEGORIES.map((category) => (
            <Link
              key={category.value}
              href={`/products?category=${category.value}`}
              className="text-zinc-600 transition-colors hover:text-black dark:text-zinc-400 dark:hover:text-white"
            >
              {category.label}
            </Link>
          ))}
        </nav>

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

      {menuOpen && (
        <nav
          data-mobile-menu="true"
          className="flex flex-col gap-1 border-t border-black/10 px-4 py-3 text-sm font-medium dark:border-white/10 sm:hidden"
        >
          {CATEGORIES.map((category) => (
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
