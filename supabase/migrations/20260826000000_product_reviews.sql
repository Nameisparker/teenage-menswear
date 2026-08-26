-- Product reviews — star rating + written comment, shown on the product page.
--
-- Open to any signed-in customer (not gated on having purchased the product).
-- One review per customer per product: the unique constraint lets the client
-- upsert, so writing a review and editing it later are the same code path.
--
-- reviewer_name is snapshotted from profiles at insert time by a trigger,
-- rather than joined live, for the same reason order_items snapshots product
-- name/price (see 20260824000000_init_schema.sql): a later name change must
-- not rewrite past reviews. It also means the storefront never needs read
-- access to other customers' profiles (profiles.select is owner-or-admin
-- only) just to show who wrote a review.

create table public.product_reviews (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  reviewer_name text not null default '',
  rating        smallint not null check (rating between 1 and 5),
  comment       text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (product_id, user_id)
);

comment on table public.product_reviews is
  'One review per (product_id, user_id). reviewer_name is a snapshot — see
   note above — never read live from profiles.';

create index product_reviews_product_idx
  on public.product_reviews (product_id, created_at desc);

create trigger product_reviews_touch_updated_at
  before update on public.product_reviews
  for each row execute function public.touch_updated_at();

-- Stamps reviewer_name from the caller's own profile. SECURITY DEFINER so it
-- can read profiles despite that table's owner-or-admin select policy; scoped
-- to new.user_id only, so it cannot be used to read anyone else's name.
create or replace function public.stamp_review_author()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select coalesce(p.full_name, split_part(p.email, '@', 1), 'Customer')
    into new.reviewer_name
    from public.profiles p
    where p.id = new.user_id;

  if new.reviewer_name is null or new.reviewer_name = '' then
    new.reviewer_name := 'Customer';
  end if;

  return new;
end;
$$;

revoke execute on function public.stamp_review_author() from anon, authenticated, public;

create trigger product_reviews_stamp_author
  before insert on public.product_reviews
  for each row execute function public.stamp_review_author();

alter table public.product_reviews enable row level security;

-- Public read, like the rest of the catalog — reviews are meant to be seen by
-- signed-out shoppers too.
create policy "Reviews are public"
  on public.product_reviews for select
  to anon, authenticated
  using (true);

create policy "Customers create their own reviews"
  on public.product_reviews for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Customers update their own reviews"
  on public.product_reviews for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Merged into one OR'd policy rather than two separate ones, so Postgres
-- checks a single permissive policy per delete instead of two — see
-- 20260825010000_rls_performance.sql for why that matters.
create policy "Customers delete their own reviews, admins delete any"
  on public.product_reviews for delete
  to authenticated
  using ((select auth.uid()) = user_id or (select public.is_admin()));
