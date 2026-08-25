-- Row Level Security: performance, not policy.
--
-- Nothing here changes who can see or do what. Every rule below grants exactly
-- what it granted before; the difference is how often Postgres has to work it
-- out. Driven by the Supabase database linter (lints 0001, 0003, 0006).
--
-- Two problems are addressed.
--
-- 1. auth.uid() written bare in a policy is re-evaluated *per row*. Wrapping it
--    as (select auth.uid()) turns it into an InitPlan: evaluated once, then
--    treated as a constant for the scan. On one customer's own orders that is a
--    handful of rows; on an admin listing every order it is the whole table.
--
-- 2. Two permissive policies on the same table, role and action means both run
--    for every row, and the ownership check still runs for an admin who was
--    already allowed by the other. Merging each pair into one policy with OR
--    lets Postgres stop at the first branch that succeeds.
--
-- The FOR ALL admin policies are the reason for the overlap: FOR ALL includes
-- SELECT, so each one silently doubled up with the public read policy. They are
-- split into INSERT/UPDATE/DELETE below. Reads then collapse to a single policy
-- everywhere except products and product_variants, where they cannot — see the
-- Catalog section for why.

-- ---------------------------------------------------------------------------
-- Foreign keys without a covering index
--
-- Postgres does not index the referencing side automatically. Without these,
-- deleting a product scans all of order_items and cart_items to enforce the
-- constraint, and the cart's join to products has no index to work from.
-- ---------------------------------------------------------------------------

create index if not exists cart_items_product_idx
  on public.cart_items (product_id);

create index if not exists order_items_product_idx
  on public.order_items (product_id);

-- ---------------------------------------------------------------------------
-- Catalog
--
-- products and product_variants keep TWO select policies rather than one merged
-- one, so the linter's "multiple permissive policies" warning stays on them
-- deliberately. Merging would mean `using (is_active or public.is_admin())` on a
-- policy that also serves `anon` — and is_admin() has EXECUTE revoked from anon
-- (see 20260824000005). Postgres would raise "permission denied for function
-- is_admin" the moment it evaluated the second branch, which it must do for any
-- inactive row. That breaks the entire storefront for signed-out visitors to
-- silence a warning. The (select ...) wrapping below is applied either way, and
-- that is where the real cost was.
-- ---------------------------------------------------------------------------

drop policy if exists "Active products are public" on public.products;
drop policy if exists "Admins read all products"   on public.products;
drop policy if exists "Admins manage products"     on public.products;

create policy "Active products are public"
  on public.products for select
  to anon, authenticated
  using (is_active);

create policy "Admins read all products"
  on public.products for select
  to authenticated
  using ((select public.is_admin()));

create policy "Admins insert products"
  on public.products for insert
  to authenticated
  with check ((select public.is_admin()));

create policy "Admins update products"
  on public.products for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Admins delete products"
  on public.products for delete
  to authenticated
  using ((select public.is_admin()));

drop policy if exists "Variants of active products are public" on public.product_variants;
drop policy if exists "Admins manage product variants"         on public.product_variants;

create policy "Variants of active products are public"
  on public.product_variants for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_variants.product_id and p.is_active
    )
  );

-- The dropped FOR ALL policy was what let an admin see variants of an inactive
-- product. Splitting it means that read has to be restated explicitly.
create policy "Admins read all product variants"
  on public.product_variants for select
  to authenticated
  using ((select public.is_admin()));

create policy "Admins insert product variants"
  on public.product_variants for insert
  to authenticated
  with check ((select public.is_admin()));

create policy "Admins update product variants"
  on public.product_variants for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Admins delete product variants"
  on public.product_variants for delete
  to authenticated
  using ((select public.is_admin()));

drop policy if exists "Categories are public"    on public.categories;
drop policy if exists "Admins manage categories" on public.categories;

create policy "Categories are readable"
  on public.categories for select
  to anon, authenticated
  using (true);

create policy "Admins insert categories"
  on public.categories for insert
  to authenticated
  with check ((select public.is_admin()));

create policy "Admins update categories"
  on public.categories for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Admins delete categories"
  on public.categories for delete
  to authenticated
  using ((select public.is_admin()));

drop policy if exists "Store settings are public"    on public.store_settings;
drop policy if exists "Admins manage store settings" on public.store_settings;

create policy "Store settings are readable"
  on public.store_settings for select
  to anon, authenticated
  using (true);

create policy "Admins insert store settings"
  on public.store_settings for insert
  to authenticated
  with check ((select public.is_admin()));

create policy "Admins update store settings"
  on public.store_settings for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- No delete policy for store_settings. The dropped FOR ALL policy granted one;
-- this is the single narrowing in this migration, and it is on purpose. That
-- table holds exactly one row that the root layout reads on every request —
-- deleting it takes the whole site down, and nothing in the app ever does.

-- ---------------------------------------------------------------------------
-- Customer data
-- ---------------------------------------------------------------------------

drop policy if exists "Customers read their own profile"   on public.profiles;
drop policy if exists "Admins read all profiles"           on public.profiles;
drop policy if exists "Customers create their own profile" on public.profiles;
drop policy if exists "Customers update their own profile" on public.profiles;

create policy "Profiles are readable by owner or admin"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id or (select public.is_admin()));

create policy "Customers create their own profile"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

create policy "Customers update their own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "Customers manage their own addresses" on public.addresses;

create policy "Customers manage their own addresses"
  on public.addresses for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Customers manage their own cart" on public.cart_items;

create policy "Customers manage their own cart"
  on public.cart_items for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Orders
--
-- Customers still have no update or delete path here. That is the point of the
-- original design and it is preserved exactly: only admins update, nobody
-- deletes, and order_events keeps no write policy at all because the
-- log_order_status trigger remains its only writer.
-- ---------------------------------------------------------------------------

drop policy if exists "Customers read their own orders"  on public.orders;
drop policy if exists "Admins read all orders"           on public.orders;
drop policy if exists "Customers place their own orders" on public.orders;
drop policy if exists "Admins update orders"             on public.orders;

create policy "Orders are readable by owner or admin"
  on public.orders for select
  to authenticated
  using ((select auth.uid()) = user_id or (select public.is_admin()));

create policy "Customers place their own orders"
  on public.orders for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Admins update orders"
  on public.orders for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "Customers read their own order items"    on public.order_items;
drop policy if exists "Admins read all order items"             on public.order_items;
drop policy if exists "Customers add items to their own orders" on public.order_items;

create policy "Order items are readable by owner or admin"
  on public.order_items for select
  to authenticated
  using (
    (select public.is_admin())
    or exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.user_id = (select auth.uid())
    )
  );

create policy "Customers add items to their own orders"
  on public.order_items for insert
  to authenticated
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.user_id = (select auth.uid())
    )
  );

drop policy if exists "Customers read events for their own orders" on public.order_events;
drop policy if exists "Admins read all order events"               on public.order_events;

create policy "Order events are readable by owner or admin"
  on public.order_events for select
  to authenticated
  using (
    (select public.is_admin())
    or exists (
      select 1 from public.orders o
      where o.id = order_events.order_id and o.user_id = (select auth.uid())
    )
  );
