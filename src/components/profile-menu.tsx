"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  avatarUrlFor,
  displayNameFor,
  initialsFor,
  useAuth,
} from "@/context/auth-context";

/**
 * Avatar button for the signed-in user, with the account links folded into a
 * dropdown. `isAdmin` only decides what is drawn here — /admin is gated on the
 * server by the admin layout and, underneath that, by RLS.
 */
export function ProfileMenu() {
  const { user, isAdmin, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // A menu that only closes on its own items is a trap on touch devices, so
  // listen for a click anywhere outside it, and for Escape.
  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (!user) return null;

  const name = displayNameFor(user);
  const avatarUrl = avatarUrlFor(user);
  // Only worth a second line when it says something the name does not.
  const contact = user.email ?? user.phone ?? null;

  const itemClass =
    "block rounded-md px-3 py-2 text-left text-sm text-zinc-700 transition-colors hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/10";

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((isOpen) => !isOpen)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className={`flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border text-xs font-semibold uppercase transition-colors ${
          isAdmin
            ? "border-accent text-accent"
            : "border-black/15 text-zinc-700 hover:border-black/40 dark:border-white/20 dark:text-zinc-300 dark:hover:border-white/50"
        } bg-zinc-100 dark:bg-zinc-800`}
      >
        {avatarUrl ? (
          // Provider avatars come from arbitrary hosts; next/image would need
          // every one of them listed in next.config remotePatterns.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          initialsFor(user)
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Account"
          className="absolute right-0 top-full z-20 mt-2 w-56 rounded-xl border border-black/10 bg-white p-1 shadow-lg dark:border-white/10 dark:bg-zinc-950"
        >
          <div className="px-3 py-2">
            <p className="truncate text-sm font-semibold" title={name}>
              {name}
            </p>
            {contact && contact !== name && (
              <p
                className="truncate text-xs text-zinc-500 dark:text-zinc-400"
                title={contact}
              >
                {contact}
              </p>
            )}
            {isAdmin && (
              <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-accent">
                Admin
              </p>
            )}
          </div>

          <div className="my-1 border-t border-black/10 dark:border-white/10" />

          <Link
            href="/account"
            role="menuitem"
            onClick={() => setOpen(false)}
            className={itemClass}
          >
            Edit profile
          </Link>
          <Link
            href="/orders"
            role="menuitem"
            onClick={() => setOpen(false)}
            className={itemClass}
          >
            My orders
          </Link>
          {isAdmin && (
            <>
              <Link
                href="/admin/products"
                role="menuitem"
                onClick={() => setOpen(false)}
                className={itemClass}
              >
                Manage products
              </Link>
              <Link
                href="/admin/orders"
                role="menuitem"
                onClick={() => setOpen(false)}
                className={itemClass}
              >
                Manage orders
              </Link>
            </>
          )}

          <div className="my-1 border-t border-black/10 dark:border-white/10" />

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void signOut();
            }}
            className={`w-full ${itemClass}`}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
