"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useNewOrders } from "@/context/new-orders-context";

const LINKS = [
  { href: "/admin/products", label: "Products" },
  { href: "/admin/featured", label: "Featured" },
  { href: "/admin/discounts", label: "Discounts" },
] as const;

/**
 * Admin nav. The unread count and connection state belong to the bell, not
 * here — two places showing the same number is two places to disagree.
 */
export function AdminNav() {
  const pathname = usePathname();
  const { unreadCount, markAllRead } = useNewOrders();
  const onOrdersList = pathname === "/admin/orders";

  // Reaching the list means they have been seen. Done in an effect, not on
  // click, because the list is also reachable from the bell, a bookmark, or the
  // back button.
  useEffect(() => {
    if (onOrdersList && unreadCount > 0) markAllRead();
  }, [onOrdersList, unreadCount, markAllRead]);

  return (
    <nav className="flex gap-4 text-sm font-medium">
      {LINKS.map((link) => {
        const active = pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`transition-colors ${
              active
                ? "text-black dark:text-white"
                : "text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-white"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
