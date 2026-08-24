-- Cart and checkout operations that must be atomic or trustworthy.
--
-- Both run SECURITY INVOKER, so RLS still applies: a caller can only touch
-- their own cart and can only create an order for themselves. That is
-- deliberate — these functions exist for atomicity and price integrity, not to
-- escalate privileges.

-- ---------------------------------------------------------------------------
-- add_to_cart
--
-- The client cannot express "increment" through a plain upsert, and a
-- read-then-write from the browser races with itself (double-clicking Add to
-- cart, or the same account in two tabs). One statement with ON CONFLICT keeps
-- it atomic.
-- ---------------------------------------------------------------------------

create or replace function public.add_to_cart(
  p_product_id uuid,
  p_size       text,
  p_qty        integer default 1
)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.cart_items (user_id, product_id, size, quantity)
  values (auth.uid(), p_product_id, p_size, greatest(p_qty, 1))
  on conflict (user_id, product_id, size)
  do update set quantity = cart_items.quantity + greatest(p_qty, 1);
$$;

-- ---------------------------------------------------------------------------
-- place_order
--
-- Prices are read from the products table inside this function, never accepted
-- from the caller. If the browser supplied the totals it could send a total of
-- zero. Line items are snapshotted here so later catalog edits cannot rewrite
-- order history.
--
-- The whole thing is one transaction: order, its items, and clearing the cart
-- either all happen or none do — no orphaned order with no items, and no cart
-- emptied without an order.
-- ---------------------------------------------------------------------------

create or replace function public.place_order(
  p_full_name text,
  p_phone     text,
  p_email     text,
  p_line1     text,
  p_city      text,
  p_pin_code  text
)
returns public.orders
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user  uuid := auth.uid();
  v_total integer;
  v_order public.orders;
begin
  if v_user is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  select coalesce(sum(p.price * ci.quantity), 0)
    into v_total
  from public.cart_items ci
  join public.products p on p.id = ci.product_id
  where ci.user_id = v_user;

  if v_total = 0 then
    raise exception 'Cart is empty' using errcode = 'P0001';
  end if;

  -- order_number is filled in by the assign_order_number trigger.
  insert into public.orders (
    user_id, ship_full_name, ship_phone, ship_email,
    ship_line1, ship_city, ship_pin_code, subtotal, total
  ) values (
    v_user, p_full_name, p_phone, nullif(p_email, ''),
    p_line1, p_city, p_pin_code, v_total, v_total
  )
  returning * into v_order;

  insert into public.order_items (
    order_id, product_id, name, slug, size, unit_price, quantity, image_path
  )
  select v_order.id, p.id, p.name, p.slug, ci.size, p.price, ci.quantity, p.image_path
  from public.cart_items ci
  join public.products p on p.id = ci.product_id
  where ci.user_id = v_user;

  delete from public.cart_items where user_id = v_user;

  return v_order;
end;
$$;
