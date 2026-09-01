-- Online payment via Razorpay, alongside cash on delivery.
--
-- Two axes, deliberately kept apart: `status` is fulfilment (placed →
-- confirmed → shipped → delivered) and `payment_status` is money. A COD order
-- ships while still unpaid and is paid at the door; a prepaid order is paid
-- before anything moves. Folding both into one enum makes "shipped but not yet
-- paid" unrepresentable — which is the normal state of every COD order here.

create type public.payment_method as enum ('cod', 'razorpay');
create type public.payment_status as enum ('unpaid', 'paid', 'failed', 'refunded');

alter table public.orders
  add column payment_method      public.payment_method not null default 'cod',
  add column payment_status      public.payment_status not null default 'unpaid',
  add column razorpay_order_id   text,
  add column razorpay_payment_id text,
  add column paid_at             timestamptz;

comment on column public.orders.payment_status is
  'Money, not fulfilment. A COD order stays ''unpaid'' until an admin marks it
   paid on delivery; a Razorpay order is flipped to ''paid'' only by the verify
   or webhook Edge Function, never by the browser.';

comment on column public.orders.razorpay_order_id is
  'The order id Razorpay issued for this order. Written by the
   razorpay-create-order function and used by the webhook to find the row.';

-- The webhook finds our order by this id, so Razorpay must never be able to map
-- one of its orders onto two of ours. Partial, because COD orders have none.
create unique index orders_razorpay_order_idx
  on public.orders (razorpay_order_id)
  where razorpay_order_id is not null;

-- ---------------------------------------------------------------------------
-- Column privileges
--
-- place_order runs SECURITY INVOKER, so the INSERT happens as the customer and
-- the customer therefore needs INSERT on public.orders. The RLS policy only
-- checks user_id — it does not care which columns are set — so without the
-- grant below, anyone could POST straight to /rest/v1/orders with
-- payment_status = 'paid' and skip payment entirely.
--
-- Same shape as the profiles/role guard in 20260824000005: a column-level
-- REVOKE does nothing against a table-wide grant, so the table-wide grant has
-- to go first and the permitted columns are granted back.
-- ---------------------------------------------------------------------------

revoke insert, update on public.orders from anon, authenticated;

grant insert (
  user_id,
  ship_full_name, ship_phone, ship_email,
  ship_line1, ship_city, ship_pin_code,
  subtotal, total,
  payment_method
) on public.orders to authenticated;

-- Only admins have an UPDATE policy on orders, so this is the admin surface:
-- the status control, and marking a COD order paid once it is handed over.
-- razorpay_* and paid_at stay off the list — those are the payment functions'
-- to write, using the service role.
grant update (status, payment_status) on public.orders to authenticated;

-- ---------------------------------------------------------------------------
-- place_order learns about payment
--
-- The cart is now cleared only for COD. A prepaid order is created before the
-- customer has paid anything, so emptying the cart there would lose it on every
-- abandoned payment; the verify/webhook function clears it once money arrives.
-- ---------------------------------------------------------------------------

-- Dropped rather than replaced: adding a parameter creates an overload, and a
-- six-argument call would then be ambiguous.
drop function if exists public.place_order(text, text, text, text, text, text);

create or replace function public.place_order(
  p_full_name      text,
  p_phone          text,
  p_email          text,
  p_line1          text,
  p_city           text,
  p_pin_code       text,
  p_payment_method public.payment_method
)
returns public.orders
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user     uuid := auth.uid();
  v_subtotal integer;
  v_total    integer;
  v_order    public.orders;
begin
  if v_user is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  select coalesce(sum(p.price * ci.quantity), 0),
         coalesce(sum(p.offer_price * ci.quantity), 0)
    into v_subtotal, v_total
  from public.cart_items ci
  join public.products p on p.id = ci.product_id
  where ci.user_id = v_user;

  if v_total = 0 then
    raise exception 'Cart is empty' using errcode = 'P0001';
  end if;

  -- order_number is filled in by the assign_order_number trigger.
  insert into public.orders (
    user_id, ship_full_name, ship_phone, ship_email,
    ship_line1, ship_city, ship_pin_code, subtotal, total, payment_method
  ) values (
    v_user, p_full_name, p_phone, nullif(p_email, ''),
    p_line1, p_city, p_pin_code, v_subtotal, v_total, p_payment_method
  )
  returning * into v_order;

  insert into public.order_items (
    order_id, product_id, name, slug, size, unit_price, quantity, image_path
  )
  select v_order.id, p.id, p.name, p.slug, ci.size,
         p.offer_price, ci.quantity, p.image_path
  from public.cart_items ci
  join public.products p on p.id = ci.product_id
  where ci.user_id = v_user;

  if p_payment_method = 'cod' then
    delete from public.cart_items where user_id = v_user;
  end if;

  return v_order;
end;
$$;

grant execute on function public.place_order(
  text, text, text, text, text, text, public.payment_method
) to authenticated;
