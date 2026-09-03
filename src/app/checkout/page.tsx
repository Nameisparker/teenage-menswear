"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCart } from "@/context/cart-context";
import { useAuth } from "@/context/auth-context";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatPrice } from "@/lib/format";
import { Price } from "@/components/price";
import { digitsOnly } from "@/lib/phone";
import { usePinCity } from "@/lib/use-pin-city";
import { PinHint } from "@/components/pin-hint";
import {
  loadRazorpayCheckout,
  openRazorpayCheckout,
  type RazorpaySession,
} from "@/lib/payment";
import type {
  AddressRow,
  PaymentMethod,
} from "@/lib/supabase/database.types";

/** What place_order returns — enough to drive the payment and confirm it. */
type PlacedOrder = {
  id: string;
  order_number: string;
  total: number;
};

/** Maps a place_order failure onto something a customer can act on. */
function checkoutError(message: string): string {
  const lower = message.toLowerCase();
  // place_order words this one for the customer, naming the product, the size
  // and how many are left, so it is shown through rather than replaced — a
  // generic failure here leaves them with nothing to fix.
  const shortage = message.match(/out of stock:\s*(.+)$/i);
  if (shortage) {
    // "only 0 left" is accurate and reads terribly. At zero the customer does
    // not need a number, they need to know it has gone and what to do.
    const gone = message.match(/only 0 left of "(.+?)" in size (.+?)\./i);
    if (gone) {
      return `${gone[1]} in size ${gone[2]} just sold out. Please remove it from your cart.`;
    }
    return `${shortage[1]} Please update your cart and retry.`;
  }
  if (lower.includes("cart is empty")) return "Your cart is empty.";
  if (lower.includes("not signed in")) {
    return "Your session expired. Please sign in again.";
  }
  if (lower.includes("pin_code")) {
    return "That PIN code doesn’t look right — it should be 6 digits.";
  }
  if (lower.includes("violates") || lower.includes("constraint")) {
    return "Some of those details weren’t accepted. Please check and retry.";
  }
  if (lower.includes("fetch") || lower.includes("network")) {
    return "We couldn’t reach the server. Check your connection and retry.";
  }
  return "We couldn’t place your order. Please try again in a moment.";
}

export default function CheckoutPage() {
  const { items, totalPrice, totalListPrice, loading, error: cartError, refresh } =
    useCart();
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const savings = totalListPrice - totalPrice;
  const { user } = useAuth();
  const [placed, setPlaced] = useState<PlacedOrder | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("cod");
  // Set when a prepaid order exists but the payment did not go through, so the
  // customer is told their order was kept rather than silently losing it.
  const [unpaidOrder, setUnpaidOrder] = useState<PlacedOrder | null>(null);

  // PIN and city are controlled so the lookup can fill the city in. City
  // stays editable either way — the postal district is not always what
  // someone calls the place they live.
  const { pinCode, city, setCity, pinState, handlePinChange, seed } =
    usePinCity();

  // The address saved on /account, when there is one. Filling it in here is
  // the whole point of storing it.
  const [saved, setSaved] = useState<AddressRow | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const supabase = getSupabaseBrowserClient();
      if (!user || !supabase) return;

      const { data } = await supabase
        .from("addresses")
        .select("id, user_id, full_name, phone, line1, city, pin_code, is_default")
        .eq("user_id", user.id)
        .order("is_default", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled || !data) return;
      const address = data as AddressRow;
      setSaved(address);
      // seed() rather than handlePinChange(): the city is already known, so
      // there is nothing to look up.
      seed(address.pin_code, address.city);
    })();

    return () => {
      cancelled = true;
    };
    // seed is stable for the life of the hook.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Items can only reach the cart while signed in, so prefill what we know
  // rather than making the user retype it.
  const meta = user?.user_metadata ?? {};
  const prefill = {
    name:
      saved?.full_name ??
      ((meta.full_name ?? meta.name) as string | undefined) ??
      "",
    email: user?.email ?? "",
    phone: saved?.phone
      ? digitsOnly(saved.phone).slice(-10)
      : user?.phone
        ? digitsOnly(user.phone).slice(-10)
        : "",
    address: saved?.line1 ?? "",
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError("Checkout is not configured.");
      return;
    }

    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setError(null);
    setUnpaidOrder(null);

    // Totals are deliberately NOT sent. place_order recomputes them from the
    // products table, so the browser cannot dictate what an order costs.
    const { data, error: rpcError } = await supabase
      .rpc("place_order", {
        p_full_name: String(form.get("fullName") ?? ""),
        p_phone: String(form.get("phone") ?? ""),
        p_email: String(form.get("email") ?? ""),
        p_line1: String(form.get("address") ?? ""),
        p_city: String(form.get("city") ?? ""),
        p_pin_code: String(form.get("pinCode") ?? ""),
        p_payment_method: method,
      })
      .single();

    if (rpcError) {
      // Postgres messages are for developers: they name functions, columns,
      // and constraints. Log the real one, show the customer something they
      // can act on.
      console.error("place_order failed", rpcError);
      setError(checkoutError(rpcError.message));
      setSubmitting(false);
      return;
    }

    const order = data as PlacedOrder;

    if (method === "cod") {
      // Best effort, and deliberately not awaited: the order is placed either
      // way, and the confirmation view must not wait on an email. Prepaid
      // orders are not notified here — razorpay-verify sends theirs once the
      // money actually arrives, so this would be a duplicate.
      void supabase.functions.invoke("notify-order", {
        body: { orderId: order.id, event: "placed" },
      });

      setPlaced(order);
      // place_order clears the cart server-side; sync local state to match.
      await refresh();
      setSubmitting(false);
      return;
    }

    await payForOrder(order);
  }

  /**
   * Takes a freshly placed prepaid order through Razorpay.
   *
   * The order already exists and is unpaid; nothing here can change what it
   * costs. Every exit that is not a verified payment leaves it that way, and
   * says so, rather than pretending the order failed — it is in the database
   * either way.
   */
  async function payForOrder(order: PlacedOrder) {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    try {
      const [{ data: session, error: sessionError }] = await Promise.all([
        supabase.functions.invoke<RazorpaySession>("razorpay-create-order", {
          body: { orderId: order.id },
        }),
        // Fetched alongside, not after: the widget script and the Razorpay
        // order have nothing to do with each other.
        loadRazorpayCheckout(),
      ]);

      if (sessionError || !session) throw sessionError ?? new Error("No session");

      const result = await openRazorpayCheckout(session, "Teenage Menswear");

      if (result.dismissed) {
        setUnpaidOrder(order);
        setSubmitting(false);
        return;
      }

      // The signature is checked in the Edge Function against the key secret.
      // A "success" the browser made up gets rejected there.
      const { data: verified, error: verifyError } =
        await supabase.functions.invoke<{ ok: boolean }>("razorpay-verify", {
          body: {
            razorpayOrderId: result.response.razorpay_order_id,
            razorpayPaymentId: result.response.razorpay_payment_id,
            signature: result.response.razorpay_signature,
          },
        });

      if (verifyError || !verified?.ok) {
        // The money may well have left their account — the webhook will settle
        // it. Never tell them the payment failed when we simply cannot confirm
        // it from here.
        console.error("razorpay verify failed", verifyError);
        setError(
          "We could not confirm your payment from here. If it was debited, your order will update shortly — check My orders."
        );
        setUnpaidOrder(order);
        setSubmitting(false);
        return;
      }

      setPlaced(order);
      await refresh();
      setSubmitting(false);
    } catch (paymentError) {
      console.error("razorpay payment failed", paymentError);
      setError(
        "We couldn’t start the online payment. Your order is saved — retry the payment, or place it as cash on delivery."
      );
      setUnpaidOrder(order);
      setSubmitting(false);
    }
  }

  if (placed) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 py-16 sm:px-6">
        <h1 className="text-2xl font-semibold">Order placed</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Thanks for your order! Your reference is{" "}
          <span className="font-medium tabular-nums text-foreground">
            {placed.order_number}
          </span>
          {" — "}
          {formatPrice(placed.total)}
          {method === "razorpay"
            ? ", paid online. We’ll call to confirm delivery."
            : ", payable on delivery. We’ll call to confirm."}
        </p>
        <Link
          href="/products"
          className="flex h-12 items-center justify-center rounded-full bg-black px-6 font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          Continue shopping
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <p className="text-zinc-500 dark:text-zinc-400">Loading your cart…</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 py-16 sm:px-6">
        <h1 className="text-2xl font-semibold">
          {cartError ? "We couldn’t load your cart" : "Your cart is empty"}
        </h1>
        {cartError && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {cartError}
          </p>
        )}
        <Link
          href="/products"
          className="flex h-12 items-center justify-center rounded-full bg-black px-6 font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          Continue shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 sm:grid-cols-2">
      {/* Remount when the session — or the saved address — resolves, so the
          prefilled defaults apply. */}
      <form
        key={`${user?.id ?? "anonymous"}-${saved?.id ?? "no-address"}`}
        onSubmit={handleSubmit}
        className="flex flex-col gap-4"
      >
        <h1 className="mb-2 text-2xl font-semibold">Checkout</h1>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Full name
          <input
            required
            name="fullName"
            type="text"
            defaultValue={prefill.name}
            className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/20 dark:bg-transparent"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Email
          <input
            required
            name="email"
            type="email"
            defaultValue={prefill.email}
            className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/20 dark:bg-transparent"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Phone number
          <input
            required
            name="phone"
            type="tel"
            pattern="[0-9]{10}"
            placeholder="10-digit mobile number"
            defaultValue={prefill.phone}
            className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/20 dark:bg-transparent"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Address
          <textarea
            required
            name="address"
            rows={3}
            defaultValue={prefill.address}
            className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/20 dark:bg-transparent"
          />
        </label>

        <div className="grid grid-cols-2 gap-4">
          {/* PIN first: it fills the city in, so asking for it second would
              have people type a city that is about to be overwritten. */}
          <label className="flex flex-col gap-1 text-sm font-medium">
            PIN code
            <input
              required
              name="pinCode"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="6-digit PIN"
              value={pinCode}
              onChange={(event) => handlePinChange(event.target.value)}
              className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/20 dark:bg-transparent"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            City
            <input
              required
              name="city"
              type="text"
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder={
                pinState.status === "loading" ? "Looking up…" : undefined
              }
              className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/20 dark:bg-transparent"
            />
          </label>
        </div>

        <PinHint state={pinState} />

        <fieldset className="mt-2 flex flex-col gap-3">
          <legend className="mb-2 text-sm font-semibold">How to pay</legend>

          <PaymentChoice
            checked={method === "cod"}
            onChange={() => setMethod("cod")}
            title="Cash on delivery"
            detail="Pay the courier when it arrives."
          />
          <PaymentChoice
            checked={method === "razorpay"}
            onChange={() => setMethod("razorpay")}
            title="Pay online"
            detail="UPI, card, or netbanking via Razorpay."
          />
        </fieldset>

        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        {/* The order exists and is unpaid. Offering the payment again beats
            making them re-enter an address to create a duplicate order. */}
        {unpaidOrder && !submitting && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
            <p className="font-medium text-amber-900 dark:text-amber-200">
              Order {unpaidOrder.order_number} is saved but not paid.
            </p>
            <button
              type="button"
              onClick={() => {
                setSubmitting(true);
                setError(null);
                void payForOrder(unpaidOrder);
              }}
              className="mt-2 font-medium text-accent underline-offset-2 hover:underline"
            >
              Try the payment again
            </button>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 flex h-12 w-full items-center justify-center rounded-full bg-accent px-6 font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {submitting
            ? method === "razorpay"
              ? "Opening payment…"
              : "Placing order…"
            : method === "razorpay"
              ? `Pay ${formatPrice(totalPrice)}`
              : `Place order — ${formatPrice(totalPrice)}`}
        </button>
      </form>

      {/* The bill. Sticks alongside a long form on desktop so the total stays
          in view while the address is filled in. */}
      <div className="flex flex-col gap-4 rounded-xl border border-black/10 p-5 sm:sticky sm:top-6 sm:self-start dark:border-white/10">
        <h2 className="text-lg font-semibold">
          Order summary{" "}
          <span className="font-normal text-zinc-500 dark:text-zinc-400">
            ({totalItems} item{totalItems === 1 ? "" : "s"})
          </span>
        </h2>

        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <div
              key={`${item.slug}-${item.size}`}
              className="flex justify-between gap-4 text-sm"
            >
              <span>
                {item.name}
                <span className="text-zinc-500 dark:text-zinc-400">
                  {" "}
                  · {item.size} &times; {item.quantity}
                </span>
              </span>
              <Price
                price={item.price}
                offerPrice={item.offerPrice}
                discountPercent={item.discountPercent}
                quantity={item.quantity}
                className="shrink-0"
              />
            </div>
          ))}
        </div>

        <dl className="flex flex-col gap-2 border-t border-black/10 pt-4 text-sm dark:border-white/10">
          <div className="flex justify-between">
            <dt className="text-zinc-500 dark:text-zinc-400">
              Price ({totalItems} item{totalItems === 1 ? "" : "s"})
            </dt>
            <dd>{formatPrice(totalListPrice)}</dd>
          </div>

          {savings > 0 && (
            <div className="flex justify-between font-medium text-accent">
              <dt>Discount</dt>
              <dd>−{formatPrice(savings)}</dd>
            </div>
          )}

          {/* Free on every order, and charged that way by place_order too —
              a delivery fee shown here that the RPC does not add would bill
              the customer a different number than the one they agreed to. */}
          <div className="flex justify-between">
            <dt className="text-zinc-500 dark:text-zinc-400">Delivery</dt>
            <dd className="font-medium text-accent">Free</dd>
          </div>
        </dl>

        <div className="flex justify-between border-t border-black/10 pt-4 text-lg font-semibold dark:border-white/10">
          <span>Total payable</span>
          <span>{formatPrice(totalPrice)}</span>
        </div>

        {savings > 0 && (
          <p className="rounded-md bg-accent/10 px-3 py-2 text-sm font-medium text-accent">
            You save {formatPrice(savings)} on this order.
          </p>
        )}

        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Prices include all taxes.
        </p>
      </div>
    </div>
  );
}

/** One payment option: a radio, styled as a selectable card. */
function PaymentChoice({
  checked,
  onChange,
  title,
  detail,
}: {
  checked: boolean;
  onChange: () => void;
  title: string;
  detail: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
        checked
          ? "border-accent bg-accent/5"
          : "border-black/15 hover:border-black/40 dark:border-white/20 dark:hover:border-white/50"
      }`}
    >
      <input
        type="radio"
        name="paymentMethod"
        checked={checked}
        onChange={onChange}
        className="mt-0.5 h-4 w-4 accent-accent"
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {detail}
        </span>
      </span>
    </label>
  );
}
