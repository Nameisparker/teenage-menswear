/**
 * Telling the customer what happened to their order.
 *
 * Until now the only notification in the system was the admin's realtime bell.
 * The person who actually paid got nothing — no confirmation, no "shipped".
 *
 * One transport is implemented, email through Resend, chosen because it needs
 * a single API call and no account-specific template setup. When its key is
 * absent every message is logged instead of sent, so this is safe to deploy
 * before anyone has signed up for anything: the wiring is exercised end to end
 * and the payload is visible in the function logs.
 *
 * WhatsApp is the channel that matters most for an Indian store and is the
 * obvious next transport. It goes in `deliver()` below, alongside the email
 * branch — everything above that function is channel-agnostic.
 */

type Recipient = {
  name: string;
  phone: string;
  email: string | null;
};

type Message = {
  subject: string;
  body: string;
};

const money = (rupees: number) => `Rs ${rupees.toLocaleString("en-IN")}`;

/** Where the customer can see the order. Falls back to a relative path. */
function orderUrl(orderNumber: string): string {
  const site = Deno.env.get("SITE_URL")?.replace(/\/+$/, "");
  return site
    ? `${site}/orders/${orderNumber}`
    : `/orders/${orderNumber}`;
}

export function orderPlacedMessage(order: {
  order_number: string;
  total: number;
  payment_method: string;
  ship_full_name: string;
}): Message {
  const cod = order.payment_method === "cod";
  return {
    subject: `Order ${order.order_number} confirmed`,
    body: [
      `Hi ${order.ship_full_name},`,
      "",
      `We have your order ${order.order_number} for ${money(order.total)}.`,
      cod
        ? "You will pay cash when it is delivered."
        : "Your payment has been received.",
      "",
      `Track it here: ${orderUrl(order.order_number)}`,
    ].join("\n"),
  };
}

export function paymentReceivedMessage(order: {
  order_number: string;
  total: number;
  ship_full_name: string;
}): Message {
  return {
    subject: `Payment received for ${order.order_number}`,
    body: [
      `Hi ${order.ship_full_name},`,
      "",
      `We have received ${money(order.total)} for order ${order.order_number}. It is confirmed and being prepared.`,
      "",
      `Track it here: ${orderUrl(order.order_number)}`,
    ].join("\n"),
  };
}

const STATUS_LINES: Record<string, string> = {
  confirmed: "is confirmed and being packed",
  shipped: "has been shipped",
  delivered: "has been delivered",
  cancelled: "has been cancelled",
};

/**
 * Null for a status with nothing worth saying. 'pending' is the state an order
 * is created in, and the placed message already covered it — sending both
 * would mean two messages for one event.
 */
export function orderStatusMessage(order: {
  order_number: string;
  status: string;
  ship_full_name: string;
}): Message | null {
  const line = STATUS_LINES[order.status];
  if (!line) return null;

  return {
    subject: `Order ${order.order_number} ${order.status}`,
    body: [
      `Hi ${order.ship_full_name},`,
      "",
      `Your order ${order.order_number} ${line}.`,
      "",
      `Details: ${orderUrl(order.order_number)}`,
    ].join("\n"),
  };
}

/**
 * Sends one message, or logs it when no transport is configured.
 *
 * Never throws. A notification that fails must not fail the thing it is
 * notifying about — an order is not less placed because an email bounced.
 * The return value says what happened so callers can log it.
 */
export async function deliver(
  to: Recipient,
  message: Message
): Promise<{ sent: boolean; via: string; error?: string }> {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("NOTIFY_FROM_EMAIL");

  if (resendKey && from && to.email) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [to.email],
          subject: message.subject,
          text: message.body,
        }),
      });

      if (!response.ok) {
        const detail = await response.text();
        console.error("notify: resend rejected", response.status, detail);
        return { sent: false, via: "resend", error: detail };
      }
      return { sent: true, via: "resend" };
    } catch (error) {
      console.error("notify: resend threw", error);
      return {
        sent: false,
        via: "resend",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // No transport, or nowhere to send it. Logged rather than dropped so the
  // wiring is verifiable and nothing is silently lost.
  console.log(
    "notify (not sent):",
    JSON.stringify({
      to: { name: to.name, phone: to.phone, email: to.email },
      subject: message.subject,
      body: message.body,
      reason: !resendKey || !from ? "no transport configured" : "no email address",
    })
  );
  return { sent: false, via: "log" };
}
