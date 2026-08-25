-- Per-product percentage discounts.
--
-- The percentage is what an admin sets; the money is derived from it. Storing
-- the offer price by hand would let the two drift the moment someone edits a
-- price without re-entering the discount, so offer_price is a generated column
-- and the database owns the arithmetic. place_order() and the storefront both
-- read the same value — they cannot disagree about what a customer owes.

alter table public.products
  add column discount_percent integer not null default 0
    check (discount_percent >= 0 and discount_percent <= 90);

comment on column public.products.discount_percent is
  'Percent off the list price. 0 means no offer. Capped at 90 so an offer can
   never round a line down to nothing.';

alter table public.products
  add column offer_price integer
    generated always as (
      greatest(round(price * (100 - discount_percent) / 100.0)::integer, 1)
    ) stored;

comment on column public.products.offer_price is
  'What the customer actually pays, in whole rupees. Equals price when there is
   no discount. Generated — never write to it.';

-- ---------------------------------------------------------------------------
-- place_order must charge the offer price
--
-- Otherwise a discount is cosmetic: the storefront shows one number and the
-- order is written with another. Only the total line changes shape — subtotal
-- now carries the list-price sum, so an order records what was saved.
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
    ship_line1, ship_city, ship_pin_code, subtotal, total
  ) values (
    v_user, p_full_name, p_phone, nullif(p_email, ''),
    p_line1, p_city, p_pin_code, v_subtotal, v_total
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

  delete from public.cart_items where user_id = v_user;

  return v_order;
end;
$$;
