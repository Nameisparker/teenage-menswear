/**
 * Sends the customer a message about one of their orders.
 *
 * Called from two places that already exist rather than from a database
 * webhook: the checkout page once a COD order is placed, and the admin's
 * setOrderStatus action once a status changes. A DB webhook would need the
 * function URL and a service-role key baked into a trigger definition — a
 * secret in a migration file, for no gain over this.
 *
 * What gets said is decided here, not by the caller, and it is read from the
 * order's current state. A caller can ask for a notification about their own
 * order; it cannot dictate the contents.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { cors, env, json } from "../_shared/razorpay.ts";
import {
  deliver,
  orderPlacedMessage,
  orderStatusMessage,
} from "../_shared/notify.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization) return json({ error: "Not signed in" }, 401);

    const { orderId, event } = await req.json();
    if (typeof orderId !== "string" || !orderId) {
      return json({ error: "orderId is required" }, 400);
    }
    if (event !== "placed" && event !== "status") {
      return json({ error: "event must be 'placed' or 'status'" }, 400);
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

    const { data: order, error } = await asService
      .from("orders")
      .select(
        "id, order_number, status, total, payment_method, user_id, ship_full_name, ship_phone, ship_email"
      )
      .eq("id", orderId)
      .maybeSingle();

    if (error) throw error;
    if (!order) return json({ error: "Order not found" }, 404);

    // Their own order, or an admin acting on it. is_admin() is asked with the
    // caller's session, so it answers for the caller and not for the service
    // role this function also holds.
    if (order.user_id !== user.id) {
      const { data: isAdmin } = await asCaller.rpc("is_admin");
      if (isAdmin !== true) return json({ error: "Order not found" }, 404);
    }

    const message =
      event === "placed"
        ? orderPlacedMessage(order)
        : orderStatusMessage(order);

    // A status with nothing worth saying is a success, not an error: the
    // caller fired on every change and this one does not need a message.
    if (!message) return json({ ok: true, skipped: order.status });

    const result = await deliver(
      {
        name: order.ship_full_name,
        phone: order.ship_phone,
        email: order.ship_email,
      },
      message
    );

    return json({ ok: true, ...result });
  } catch (error) {
    console.error("notify-order", error);
    return json({ error: "Could not send the notification" }, 500);
  }
});
