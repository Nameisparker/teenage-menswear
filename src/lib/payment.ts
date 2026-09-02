/**
 * Payment labels and the Razorpay checkout handshake.
 *
 * The browser's whole job is: ask our Edge Function to create a Razorpay order,
 * open Razorpay's widget with the id it returns, and hand the result back for
 * verification. It never sees the key secret and never decides what an order
 * costs — `orders.total` was computed in Postgres by place_order.
 */
import type { PaymentMethod, PaymentStatus } from "./supabase/database.types";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cod: "Cash on delivery",
  razorpay: "Paid online",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: "Unpaid",
  paid: "Paid",
  failed: "Payment failed",
  refunded: "Refunded",
};

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

type RazorpayHandlerResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description: string;
  prefill: { name: string; contact: string; email: string };
  theme: { color: string };
  handler: (response: RazorpayHandlerResponse) => void;
  modal: { ondismiss: () => void };
};

type RazorpayInstance = { open: () => void };

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

/**
 * Loads Razorpay's widget on demand.
 *
 * Not in the layout: it is a third-party script that every visitor would
 * download for a page almost none of them reach, and it is only needed once
 * someone has actually chosen to pay online.
 */
export function loadRazorpayCheckout(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve();

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${CHECKOUT_SRC}"]`
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Razorpay checkout failed to load"))
      );
      return;
    }

    const script = document.createElement("script");
    script.src = CHECKOUT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Razorpay checkout failed to load"));
    document.head.appendChild(script);
  });
}

export type RazorpaySession = {
  keyId: string;
  razorpayOrderId: string;
  amount: number;
  currency: string;
  orderNumber: string;
  prefill: { name: string; contact: string; email: string };
};

/**
 * Opens the widget and settles once the customer is finished with it.
 *
 * `dismissed` rather than a rejection: closing the window is an ordinary thing
 * to do, not an error. The order stays in the database as unpaid so the
 * customer can come back to it.
 */
export function openRazorpayCheckout(
  session: RazorpaySession,
  storeName: string
): Promise<
  { dismissed: true } | { dismissed: false; response: RazorpayHandlerResponse }
> {
  return new Promise((resolve) => {
    if (!window.Razorpay) {
      throw new Error("Razorpay checkout is not loaded");
    }

    let settled = false;
    const finish = (
      result:
        | { dismissed: true }
        | { dismissed: false; response: RazorpayHandlerResponse }
    ) => {
      // Razorpay fires ondismiss after a successful handler too, and the
      // second call must not overwrite a completed payment with "dismissed".
      if (settled) return;
      settled = true;
      resolve(result);
    };

    new window.Razorpay({
      key: session.keyId,
      amount: session.amount,
      currency: session.currency,
      order_id: session.razorpayOrderId,
      name: storeName,
      description: `Order ${session.orderNumber}`,
      prefill: session.prefill,
      theme: { color: "#b45309" },
      handler: (response) => finish({ dismissed: false, response }),
      modal: { ondismiss: () => finish({ dismissed: true }) },
    }).open();
  });
}
