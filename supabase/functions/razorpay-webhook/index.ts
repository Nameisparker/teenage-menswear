/**
 * Razorpay's server-to-server notification. The safety net.
 *
 * The verify function only runs if the customer's tab survives long enough to
 * call it. This one runs regardless, so a payment made by someone whose phone
 * died on the confirmation screen still lands as a paid order. Both write the
 * same fields and both check for "already paid" first, so a payment processed
 * twice changes nothing the second time.
 *
 * Deploy with JWT verification OFF — Razorpay does not carry a Supabase token.
 * The webhook secret's signature over the raw body is the authentication:
 *
 *   supabase functions deploy razorpay-webhook --no-verify-jwt
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { env, hmacSha256Hex, json, safeEqual } from "../_shared/razorpay.ts";
import { deliver, paymentReceivedMessage } from "../_shared/notify.ts";

Deno.serve(async (req) => {
  try {
    // Read the body as text, never as JSON first: the signature covers the
    // exact bytes Razorpay sent, and re-serialising a parsed object will not
    // reproduce them.
    const raw = await req.text();
    const signature = req.headers.get("x-razorpay-signature");
    if (!signature) return json({ error: "Missing signature" }, 400);

    const expected = await hmacSha256Hex(env("RAZORPAY_WEBHOOK_SECRET"), raw);
    if (!safeEqual(expected, signature)) {
      console.error("razorpay-webhook: signature mismatch");
      return json({ error: "Invalid signature" }, 401);
    }

    const event = JSON.parse(raw);
    const payment = event?.payload?.payment?.entity;
    const razorpayOrderId: string | undefined = payment?.order_id;

    // Acknowledge anything we do not act on. A non-2xx makes Razorpay retry an
    // event that will never succeed.
    if (!razorpayOrderId) return json({ ignored: event?.event ?? "unknown" });

    const asService = createClient(
      env("SUPABASE_URL"),
      env("SUPABASE_SERVICE_ROLE_KEY")
    );

    const { data: order, error } = await asService
      .from("orders")
      .select(
        "id, user_id, order_number, status, payment_status, total, ship_full_name, ship_phone, ship_email"
      )
      .eq("razorpay_order_id", razorpayOrderId)
      .maybeSingle();

    if (error) throw error;
    if (!order) {
      console.warn("razorpay-webhook: no order for", razorpayOrderId);
      return json({ ignored: "unknown order" });
    }

    if (event.event === "payment.captured") {
      if (order.payment_status !== "paid") {
        // The stale-payment job may already have cancelled this order and
        // given its stock back. The money is still real, so it is recorded —
        // but flagged, because a paid cancelled order needs a human.
        const cancelled = order.status === "cancelled";

        await asService
          .from("orders")
          .update({
            payment_status: "paid",
            razorpay_payment_id: payment.id,
            paid_at: new Date().toISOString(),
            payment_error: cancelled
              ? "Paid after the order was cancelled for non-payment — refund or re-place it."
              // A retry that succeeds clears the earlier attempt's reason.
              : null,
          })
          .eq("id", order.id);

        // Only if the order stands: a cancelled one leaves the customer their
        // cart to re-order from.
        if (!cancelled) {
          await asService.from("cart_items").delete().eq("user_id", order.user_id);

          // The customer is not here — this path exists precisely because
          // their tab closed — so this message is the only thing that tells
          // them the payment landed.
          await deliver(
            {
              name: order.ship_full_name,
              phone: order.ship_phone,
              email: order.ship_email,
            },
            paymentReceivedMessage(order)
          );
        }
      }
      return json({ ok: true });
    }

    if (event.event === "payment.failed") {
      // Never downgrade a paid order: a customer can retry a failed payment,
      // and the failure event for the first attempt may arrive after the
      // success of the second.
      if (order.payment_status !== "paid") {
        await asService
          .from("orders")
          .update({
            payment_status: "failed",
            // Razorpay's own words. error_reason is a code; the description
            // is the sentence whoever reconciles this can act on.
            payment_error:
              payment.error_description ?? payment.error_reason ?? null,
          })
          .eq("id", order.id);
      }
      return json({ ok: true });
    }

    return json({ ignored: event.event });
  } catch (error) {
    console.error("razorpay-webhook", error);
    // 500 so Razorpay retries — the failure here is ours, not theirs.
    return json({ error: "Webhook handling failed" }, 500);
  }
});
