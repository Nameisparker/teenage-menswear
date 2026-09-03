/**
 * Verifies the payment handed back to the browser by Razorpay's checkout, and
 * marks the order paid.
 *
 * This is the fast path — it runs while the customer is still looking at the
 * page, so they get a confirmed order rather than a spinner. It is not the only
 * path: razorpay-webhook does the same job for a customer whose tab closed
 * mid-payment. Both are idempotent, and whichever arrives first wins.
 *
 * The browser is not trusted here. It sends Razorpay's signature, and the order
 * is only flipped to paid if that signature recomputes from the key secret.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { cors, env, hmacSha256Hex, json, safeEqual } from "../_shared/razorpay.ts";
import { deliver, paymentReceivedMessage } from "../_shared/notify.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization) return json({ error: "Not signed in" }, 401);

    const { razorpayOrderId, razorpayPaymentId, signature } = await req.json();
    if (
      typeof razorpayOrderId !== "string" ||
      typeof razorpayPaymentId !== "string" ||
      typeof signature !== "string"
    ) {
      return json({ error: "Missing payment details" }, 400);
    }

    const supabaseUrl = env("SUPABASE_URL");
    const asCaller = createClient(supabaseUrl, env("SUPABASE_ANON_KEY"), {
      global: { headers: { Authorization: authorization } },
    });
    const asService = createClient(
      supabaseUrl,
      env("SUPABASE_SERVICE_ROLE_KEY")
    );

    const {
      data: { user },
    } = await asCaller.auth.getUser();
    if (!user) return json({ error: "Not signed in" }, 401);

    // Razorpay signs "<order_id>|<payment_id>" with the key secret.
    const expected = await hmacSha256Hex(
      env("RAZORPAY_KEY_SECRET"),
      `${razorpayOrderId}|${razorpayPaymentId}`
    );
    if (!safeEqual(expected, signature)) {
      console.error("razorpay-verify: signature mismatch", razorpayOrderId);
      return json({ error: "Payment could not be verified" }, 400);
    }

    // The row is found by the Razorpay order id, not by anything the browser
    // chose, and it still has to belong to the caller.
    const { data: order, error } = await asService
      .from("orders")
      .select(
        "id, user_id, order_number, status, payment_status, total, ship_full_name, ship_phone, ship_email"
      )
      .eq("razorpay_order_id", razorpayOrderId)
      .maybeSingle();

    if (error) throw error;
    if (!order || order.user_id !== user.id) {
      return json({ error: "Order not found" }, 404);
    }

    if (order.payment_status !== "paid") {
      // The stale-payment job may already have cancelled this order and given
      // its stock back — a tab left open on the Razorpay page outlives the
      // window. The money is real, so it is recorded, and flagged.
      const cancelled = order.status === "cancelled";

      const { error: updateError } = await asService
        .from("orders")
        .update({
          payment_status: "paid",
          razorpay_payment_id: razorpayPaymentId,
          paid_at: new Date().toISOString(),
          payment_error: cancelled
            ? "Paid after the order was cancelled for non-payment — refund or re-place it."
            // A retry that succeeds clears the earlier attempt's reason.
            : null,
        })
        .eq("id", order.id);
      if (updateError) throw updateError;

      // place_order leaves the cart alone for prepaid orders so an abandoned
      // payment does not lose it. Money has now arrived, so it goes — unless
      // the order was cancelled, in which case the cart is what they re-order
      // from.
      if (!cancelled) {
        await asService.from("cart_items").delete().eq("user_id", order.user_id);

        // Awaited rather than fired and forgotten: deliver() never throws and
        // is one API call, and the customer is still looking at the page, so a
        // confirmation that lands after they have navigated away is worse than
        // a few hundred milliseconds spent here.
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

    return json({ ok: true, orderNumber: order.order_number });
  } catch (error) {
    console.error("razorpay-verify", error);
    return json({ error: "Payment could not be verified" }, 500);
  }
});
