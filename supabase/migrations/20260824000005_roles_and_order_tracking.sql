-- Roles (customer / admin) and order status tracking.
--
-- Two things this migration is careful about:
--
-- 1. A customer must not be able to promote themselves. RLS policies are
--    row-level, so they cannot stop a user updating one *column* of a row they
--    already own — profiles already lets a customer edit their own row. The fix
--    is column-level privileges: revoke INSERT/UPDATE on `role` so the default
--    always wins, no matter what the client sends.
--
-- 2. is_admin() must be SECURITY DEFINER. Admin policies on other tables need
--    to read profiles, and profiles itself has RLS — a plain function would
--    recurse. SECURITY DEFINER bypasses RLS for that single lookup.

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------

create type public.user_role as enum ('customer', 'admin');

alter table public.profiles
  add column role public.user_role not null default 'customer';

comment on column public.profiles.role is
  'Set by an administrator via SQL or the service_role key. Clients have no
   column privilege on this, so a customer cannot escalate themselves.';

-- The escalation guard. Without it, "update my own profile" includes "make
-- myself an admin".
--
-- Note the shape carefully: a column-level REVOKE does NOTHING against a
-- table-wide grant, and Supabase grants table-wide INSERT/UPDATE on every
-- public table to anon and authenticated. So the table-wide grant has to go
-- first, then the permitted columns are granted back. `role` appears in
-- neither list, so only an elevated connection can ever set it.
revoke insert, update on public.profiles from anon, authenticated;

grant insert (id, full_name, phone, email) on public.profiles to authenticated;
grant update (full_name, phone, email)     on public.profiles to authenticated;

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Signed-out visitors have no business calling this.
revoke execute on function public.is_admin() from anon, public;

-- `authenticated` MUST keep EXECUTE, even though Supabase's linter flags it
-- (lint 0029, "Signed-In Users Can Execute SECURITY DEFINER Function").
--
-- Verified empirically: RLS policy expressions are evaluated with the calling
-- role's privileges, so revoking this makes every admin policy fail with
-- "permission denied for function is_admin" — admins lose all access.
--
-- The exposure is acceptable: the function takes no arguments and returns a
-- single boolean about the caller themselves. It reveals nothing a user does
-- not already know, and cannot be used to inspect anyone else.
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Admin write access to the catalog
--
-- Previously the catalog had no write policies at all — edits went through the
-- SQL editor. Admins now manage it from the app instead.
-- ---------------------------------------------------------------------------

create policy "Admins manage categories"
  on public.categories for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins manage products"
  on public.products for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins manage product variants"
  on public.product_variants for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins manage store settings"
  on public.store_settings for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Admins see inactive products too, which the public policy hides.
create policy "Admins read all products"
  on public.products for select
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Admin access to orders and customers
--
-- Customers still cannot update orders. Admins can — that is how an order
-- moves from pending to shipped.
-- ---------------------------------------------------------------------------

create policy "Admins read all orders"
  on public.orders for select
  to authenticated
  using (public.is_admin());

create policy "Admins update orders"
  on public.orders for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins read all order items"
  on public.order_items for select
  to authenticated
  using (public.is_admin());

create policy "Admins read all profiles"
  on public.profiles for select
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Order tracking
--
-- One row per status transition, so the customer sees a timeline rather than a
-- single opaque status. Written only by trigger — never by a client.
-- ---------------------------------------------------------------------------

create table public.order_events (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders (id) on delete cascade,
  status     public.order_status not null,
  note       text,
  created_at timestamptz not null default now()
);

create index order_events_order_idx
  on public.order_events (order_id, created_at);

alter table public.order_events enable row level security;

create policy "Customers read events for their own orders"
  on public.order_events for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_events.order_id and o.user_id = auth.uid()
    )
  );

create policy "Admins read all order events"
  on public.order_events for select
  to authenticated
  using (public.is_admin());

-- No insert/update/delete policy at all: the trigger below is the only writer.

create or replace function public.log_order_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.order_events (order_id, status, note)
    values (new.id, new.status, 'Order placed');
  elsif new.status is distinct from old.status then
    insert into public.order_events (order_id, status)
    values (new.id, new.status);
  end if;
  return new;
end;
$$;

revoke execute on function public.log_order_status() from anon, authenticated, public;

create trigger orders_log_status_insert
  after insert on public.orders
  for each row execute function public.log_order_status();

create trigger orders_log_status_update
  after update of status on public.orders
  for each row execute function public.log_order_status();
