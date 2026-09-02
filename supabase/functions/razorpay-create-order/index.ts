/**
 * Creates the Razorpay order for one of our orders, and returns what the
 * browser needs to open the checkout widget.
 *
 * The amount is read from `orders.total`, which place_order computed in
 * Postgres from the cart and the products table. Nothing the browser sends can
 * influence what is charged — the request carries only an order id.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { cors, env, json } from "../_shared/razorpay.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization) return json({ error: "Not signed in" }, 401);

    const { orderId } = await req.json();
    if (typeof orderId !== "string" || !orderId) {
      return json({ error: "orderId is required" }, 400);
    }

    const supabaseUrl = env("SUPABASE_URL");

    // Two clients on purpose: the caller's token establishes *who* is asking,
    // and only the service role may read and write the payment columns.
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

    const { data: order, error } = await asService
      .from("orders")
      .select("id, order_number, total, user_id, payment_status, razorpay_order_id, ship_full_name, ship_phone, ship_email")
      .eq("id", orderId)
      .maybeSingle();

    if (error) throw error;
    // Same answer for "does not exist" and "belongs to someone else", so this
    // cannot be used to probe for order ids.
    if (!order || order.user_id !== user.id) {
      return json({ error: "Order not found" }, 404);
    }
    if (order.payment_status === "paid") {
      return json({ error: "This order is already paid" }, 409);
    }

    const keyId = env("RAZORPAY_KEY_ID");
    let razorpayOrderId: string | null = order.razorpay_order_id;

    // Reuse the existing Razorpay order when the customer comes back to a
    // half-finished payment — creating a second one for the same order would
    // leave two payable handles on one basket.
    if (!razorpayOrderId) {
      const response = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${keyId}:${env("RAZORPAY_KEY_SECRET")}`)}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          // Razorpay works in paise; our totals are whole rupees.
          amount: order.total * 100,
          currency: "INR",
          receipt: order.order_number,
          notes: { order_id: order.id },
        }),
      });

      if (!response.ok) {
        console.error("razorpay create order failed", await response.text());
        return json({ error: "Could not start the payment" }, 502);
      }

      const created = await response.json();
      razorpayOrderId = created.id as string;

      const { error: saveError } = await asService
        .from("orders")
        .update({ razorpay_order_id: razorpayOrderId })
        .eq("id", order.id);
      if (saveError) throw saveError;
    }

    return json({
      keyId,
      razorpayOrderId,
      amount: order.total * 100,
      currency: "INR",
      orderNumber: order.order_number,
      prefill: {
        name: order.ship_full_name,
        contact: order.ship_phone,
        email: order.ship_email ?? "",
      },
    });
  } catch (error) {
    console.error("razorpay-create-order", error);
    return json({ error: "Could not start the payment" }, 500);
  }
});
