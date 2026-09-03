-- Stock, enforced in the one place it can be: inside the order transaction.
--
-- product_variants.stock has existed since the first migration and nothing has
-- ever read it. Two customers could buy the same last shirt, because the only
-- check was "does this size exist".
--
-- The check and the decrement both live inside place_order deliberately. Doing
-- it from the application means a read, a decision, and a write with a gap in
-- the middle, and that gap is exactly where an oversell happens. Here the whole
-- thing is one transaction with the rows locked, so two simultaneous checkouts
-- queue instead of racing.

drop function if exists public.place_order(
  text, text, text, text, text, text, public.payment_method
);

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
  v_short    record;
begin
  if v_user is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  -- Lock every variant this cart touches before reading any stock. Ordered by
  -- id so two carts holding the same two products queue rather than deadlock,
  -- and `for update of pv` so only the variant rows are locked — locking the
  -- cart or the products would serialise unrelated shoppers.
  perform 1
  from public.cart_items ci
  join public.product_variants pv
    on pv.product_id = ci.product_id and pv.size = ci.size
  where ci.user_id = v_user
  order by pv.id
  for update of pv;

  -- The first line that cannot be filled, if any. A missing variant row counts
  -- as zero: the size may have been withdrawn after it went into the cart.
  select p.name                  as name,
         ci.size                 as size,
         coalesce(pv.stock, 0)   as available
    into v_short
  from public.cart_items ci
  join public.products p on p.id = ci.product_id
  left join public.product_variants pv
    on pv.product_id = ci.product_id and pv.size = ci.size
  where ci.user_id = v_user
    and coalesce(pv.stock, 0) < ci.quantity
  order by p.name
  limit 1;

  -- Worded for the customer, not the developer: checkout shows this one
  -- through, because "only 2 left of X in size M" is something they can act on
  -- and a generic failure is not. See checkoutError() in the checkout page.
  if found then
    raise exception 'Out of stock: only % left of "%" in size %.',
      v_short.available, v_short.name, v_short.size
      using errcode = 'P0003';
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

  -- Held from here, including for an unpaid prepaid order: an order that exists
  -- is one someone may pay for, and stock that is not held is stock that gets
  -- sold twice. The cancel trigger below gives it back.
  update public.product_variants pv
     set stock = pv.stock - ci.quantity
    from public.cart_items ci
   where ci.user_id = v_user
     and pv.product_id = ci.product_id
     and pv.size = ci.size;

  if p_payment_method = 'cod' then
    delete from public.cart_items where user_id = v_user;
  end if;

  return v_order;
end;
$$;

-- Recreated above, so the grant has to be restated: dropping a function drops
-- its privileges with it.
grant execute on function public.place_order(
  text, text, text, text, text, text, public.payment_method
) to authenticated;

-- ---------------------------------------------------------------------------
-- Cancelling gives the stock back
--
-- SECURITY DEFINER because the customer-initiated cancel that is coming next
-- must not need write access to product_variants — and an admin's cancel
-- should not depend on the variant policy either. The trigger is the only
-- writer of these numbers outside place_order and the admin stock editor.
-- ---------------------------------------------------------------------------

create or replace function public.restore_stock_on_cancel()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    update public.product_variants pv
       set stock = pv.stock + oi.quantity
      from public.order_items oi
     where oi.order_id = new.id
       and pv.product_id = oi.product_id
       and pv.size = oi.size;
  end if;
  return new;
end;
$$;

revoke execute on function public.restore_stock_on_cancel()
  from anon, authenticated, public;

drop trigger if exists orders_restore_stock_on_cancel on public.orders;
create trigger orders_restore_stock_on_cancel
  after update of status on public.orders
  for each row execute function public.restore_stock_on_cancel();

