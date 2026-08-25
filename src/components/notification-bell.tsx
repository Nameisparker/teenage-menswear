"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useNewOrders } from "@/context/new-orders-context";
import { formatPrice } from "@/lib/format";

/**
 * Notification bell for the site header, rendered only for admins.
 *
 * It sits in the main header rather than the admin one so an order is not
 * missed while the admin happens to be browsing the storefront.
 *
 * The bell is the only alert surface: nothing is thrown over the page, so an
 * order cannot be dismissed by accident. Opening the bell marks things read.
 *
 * The list covers this page session only — it is built from live Realtime
 * events, not a stored notifications table. Anything older lives in
 * /admin/orders, which the footer links to.
 */
export function NotificationBell() {
  const { orders, unreadCount, connected, markAllRead, muted, setMuted } =
    useNewOrders();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // A panel that only closes via its own controls is a trap on touch devices.
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

  function toggle() {
    // Mark read on open, not on close: the admin has seen the list by then, and
    // marking on close would leave the badge stale if they navigate away.
    if (!open) markAllRead();
    setOpen((isOpen) => !isOpen);
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} new`
            : "Notifications"
        }
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-black/15 transition-colors hover:border-black/40 dark:border-white/20 dark:hover:border-white/50"
      >
        <BellIcon ringing={unreadCount > 0} />

        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-xs font-semibold text-accent-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}

        {/* Connection state on the bell itself. Without it, "no alerts" and "the
            socket is dead" look identical — which is the failure mode that
            matters most for something whose whole job is to interrupt you. */}
        <span
          aria-hidden="true"
          className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background ${
            connected ? "bg-emerald-500" : "bg-amber-500"
          }`}
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="New orders"
          // Anchoring a fixed-width panel to the bell pushes it off-screen on a
          // narrow viewport, because the bell is not the rightmost item — Cart
          // is. Below sm it is pinned to the viewport instead, clearing the
          // sticky header (py-4 + a 36px row = 68px, so 4.5rem leaves a hair of
          // gap). From sm up it goes back to hanging off the bell.
          className="fixed left-3 right-3 top-[4.5rem] z-30 overflow-hidden rounded-xl border border-black/10 bg-white shadow-lg dark:border-white/10 dark:bg-zinc-950 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80"
        >
          <div className="flex items-center justify-between border-b border-black/10 px-4 py-3 dark:border-white/10">
            <span className="text-sm font-semibold">New orders</span>
            <button
              type="button"
              onClick={() => setMuted(!muted)}
              className="text-xs font-medium text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
            >
              {muted ? "Unmute chime" : "Mute chime"}
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {orders.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                {connected
                  ? "Nothing new. Orders will appear here the moment they are placed."
                  : "Not connected — you will not be alerted. Reload the page to reconnect."}
              </p>
            ) : (
              orders.map((order) => (
                <Link
                  key={order.id}
                  href={`/admin/orders/${order.orderNumber}`}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="flex flex-col gap-0.5 border-b border-black/5 px-4 py-3 transition-colors last:border-b-0 hover:bg-black/5 dark:border-white/5 dark:hover:bg-white/10"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm font-medium tabular-nums">
                      {order.orderNumber}
                    </span>
                    <span className="shrink-0 text-sm font-semibold">
                      {formatPrice(order.total)}
                    </span>
                  </div>
                  <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {order.customerName}
                    {" · "}
                    {new Date(order.placedAt).toLocaleTimeString("en-IN", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </Link>
              ))
            )}
          </div>

          <Link
            href="/admin/orders"
            onClick={() => setOpen(false)}
            className="block border-t border-black/10 px-4 py-3 text-center text-sm font-medium text-accent transition-colors hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
          >
            View all orders
          </Link>
        </div>
      )}
    </div>
  );
}

function BellIcon({ ringing }: { ringing: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-5 w-5 ${ringing ? "text-accent" : ""}`}
      aria-hidden="true"
    >
      <path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6" />
      <path d="M13.7 20a2 2 0 0 1-3.4 0" />
    </svg>
  );
}
