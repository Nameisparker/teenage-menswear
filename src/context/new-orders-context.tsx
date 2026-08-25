"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAuth } from "./auth-context";
import type { OrderStatus } from "@/lib/supabase/database.types";

/**
 * Live notice of orders placed while an admin has the site open.
 *
 * One subscription lives here rather than in each consumer: the bell and its
 * connection indicator need the same events, and separate channels would mean
 * several websockets and duplicate alerts.
 *
 * Delivery is filtered by RLS, not by anything in this file — Realtime runs the
 * orders policies against the subscriber, so an admin receives every insert and
 * a customer never would. See 20260825020000_orders_realtime.sql.
 */

export type NewOrder = {
  id: string;
  orderNumber: string;
  customerName: string;
  total: number;
  status: OrderStatus;
  placedAt: string;
  /** Cleared once the admin opens the bell or the orders list. */
  read: boolean;
};

type NewOrdersValue = {
  /** Everything that arrived since this page opened, newest first. */
  orders: NewOrder[];
  unreadCount: number;
  /** True once the channel is live; false while connecting or if it drops. */
  connected: boolean;
  markAllRead: () => void;
  muted: boolean;
  setMuted: (muted: boolean) => void;
};

const NewOrdersContext = createContext<NewOrdersValue | null>(null);

const MUTE_KEY = "tm-admin-order-chime-muted";

/**
 * A short two-note chime through Web Audio, so there is no asset to ship and
 * nothing to 404. Browsers block audio until the page has been interacted with;
 * an admin clicking around will have done so, and if not this fails quietly
 * rather than throwing into the realtime callback.
 */
function playChime() {
  try {
    const AudioCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtor) return;

    const ctx = new AudioCtor();
    const now = ctx.currentTime;

    [
      { at: 0, hz: 880 },
      { at: 0.14, hz: 1174.7 },
    ].forEach(({ at, hz }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = hz;
      // Ramp rather than switch, so it reads as a chime and not a click.
      gain.gain.setValueAtTime(0.0001, now + at);
      gain.gain.exponentialRampToValueAtTime(0.15, now + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.25);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + at);
      osc.stop(now + at + 0.3);
    });

    // Free the hardware once the sound has finished.
    window.setTimeout(() => void ctx.close(), 800);
  } catch {
    // Autoplay blocked, or no audio device. The toast still appears.
  }
}

function readMuted() {
  try {
    return window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    // Private mode or blocked storage — default to audible.
    return false;
  }
}

export function NewOrdersProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const [orders, setOrders] = useState<NewOrder[]>([]);
  const [connected, setConnected] = useState(false);
  // Safe as a lazy initialiser despite the server having no localStorage:
  // readMuted() returns false there, and this value only feeds the toggle’s
  // label, which never renders during SSR because the toast stack is empty.
  const [muted, setMutedState] = useState(readMuted);

  const setMuted = useCallback((next: boolean) => {
    setMutedState(next);
    try {
      window.localStorage.setItem(MUTE_KEY, next ? "1" : "0");
    } catch {
      // Not persisting a preference is survivable; failing to set it is not.
    }
  }, []);

  useEffect(() => {
    // This provider wraps the whole site so the bell can live in the main
    // header, but only an admin has any use for the feed — and opening a
    // websocket for every shopper would be pure waste. RLS would deliver a
    // customer nothing but their own orders anyway; this just avoids the
    // connection entirely.
    if (!isAdmin) return;

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const channel = supabase
      .channel("admin-new-orders")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          const row = payload.new as {
            id: string;
            order_number: string;
            ship_full_name: string;
            total: number;
            status: OrderStatus;
            placed_at: string;
          };

          setOrders((current) =>
            // Realtime can redeliver after a reconnect; keyed by id so a
            // repeat does not show the same order twice.
            current.some((order) => order.id === row.id)
              ? current
              : [
                  {
                    id: row.id,
                    orderNumber: row.order_number,
                    customerName: row.ship_full_name,
                    total: row.total,
                    status: row.status,
                    placedAt: row.placed_at,
                    read: false,
                  },
                  ...current,
                ]
          );

          // Read the preference rather than closing over it: the channel is
          // created once, so a captured value would go stale the moment the
          // admin toggled mute. localStorage is what setMuted writes anyway.
          if (!readMuted()) playChime();

          // Pull the new row into whichever admin list is on screen, so the
          // toast and the table never disagree.
          router.refresh();
        }
      )
      .subscribe((status, err) => {
        // Logged, not swallowed: when alerts do not arrive, the difference
        // between "never subscribed", CHANNEL_ERROR and TIMED_OUT is the whole
        // diagnosis, and none of it is visible from the UI alone.
        console.info("[new-orders] channel status:", status, err ?? "");
        setConnected(status === "SUBSCRIBED");
      });

    return () => {
      void supabase.removeChannel(channel);
      // Signing out, or losing the admin role, must not leave a stale green
      // dot claiming the feed is live.
      setConnected(false);
    };
  }, [isAdmin, router]);

  const markAllRead = useCallback(() => {
    setOrders((current) =>
      // Same array back when nothing changes, so consumers do not re-render
      // on every navigation to the orders list.
      current.some((order) => !order.read)
        ? current.map((order) => ({ ...order, read: true }))
        : current
    );
  }, []);

  const unreadCount = useMemo(
    () => orders.filter((order) => !order.read).length,
    [orders]
  );


  const value = useMemo<NewOrdersValue>(
    () => ({
      orders,
      unreadCount,
      connected,
      markAllRead,
      muted,
      setMuted,
    }),
    [
      orders,
      unreadCount,
      connected,
      markAllRead,
      muted,
      setMuted,
    ]
  );

  return (
    <NewOrdersContext.Provider value={value}>
      {children}
    </NewOrdersContext.Provider>
  );
}

export function useNewOrders() {
  const ctx = useContext(NewOrdersContext);
  if (!ctx) {
    throw new Error("useNewOrders must be used within a NewOrdersProvider");
  }
  return ctx;
}
