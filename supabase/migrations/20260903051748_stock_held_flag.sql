-- Restore stock exactly once, and only for orders that actually took some.
--
-- Two holes in 20260903050748, both found by adding the auto-cancel job:
--
--   1. Every order placed before stock enforcement existed never decremented
--      anything. Cancelling one of those would have *created* inventory, and
--      the new cron job was about to cancel three of them.
--   2. pending -> cancelled -> pending -> cancelled restored twice. Nothing in
--      the app does that today, but nothing stopped it either.
--
-- A flag on the order answers both: it is set when the order is created, and
-- cleared by the same statement that gives the units back, so the restore is
-- idempotent and legacy orders (default false) are skipped.
alter table public.orders
  add column stock_held boolean not null default false;

comment on column public.orders.stock_held is
  'True while this order is holding units in product_variants. Set by
   orders_mark_stock_held on insert, cleared when the cancel trigger returns
   them. Orders predating stock enforcement are false and never restore.';

-- Not in the INSERT column grant on purpose: the client cannot claim to be
-- holding stock. A BEFORE trigger assigning NEW is not subject to the column
-- privileges the statement is checked against, so this is the only writer.
--
-- Every order created through place_order decrements stock, so this is
-- unconditional. An order inserted by some other route would be flagged
-- without having taken any — but that route does not exist in this app, and
-- anything reaching /rest/v1/orders directly is already outside the design.
create or replace function public.mark_stock_held()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.stock_held := true;
  return new;
end;
$$;

revoke execute on function public.mark_stock_held() from anon, authenticated, public;

drop trigger if exists orders_mark_stock_held on public.orders;
create trigger orders_mark_stock_held
  before insert on public.orders
  for each row execute function public.mark_stock_held();

-- BEFORE rather than AFTER now, so clearing the flag is part of the same row
-- write instead of a second UPDATE on the table this trigger is attached to.
create or replace function public.restore_stock_on_cancel()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'cancelled'
     and old.status is distinct from 'cancelled'
     and old.stock_held
     -- Once it has shipped the units are gone whatever the paperwork says.
     -- Cancelling a delivered order is a return, and returns are their own
     -- flow with their own decision about restocking.
     and old.status in ('pending', 'confirmed')
  then
    update public.product_variants pv
       set stock = pv.stock + oi.quantity
      from public.order_items oi
     where oi.order_id = new.id
       and pv.product_id = oi.product_id
       and pv.size = oi.size;

    new.stock_held := false;
  end if;

  return new;
end;
$$;

revoke execute on function public.restore_stock_on_cancel()
  from anon, authenticated, public;

drop trigger if exists orders_restore_stock_on_cancel on public.orders;
create trigger orders_restore_stock_on_cancel
  before update of status on public.orders
  for each row execute function public.restore_stock_on_cancel();
