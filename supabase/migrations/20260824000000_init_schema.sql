-- Teenage Menswear — core schema
--
-- Everything the storefront reads or writes lives here: catalog, customer
-- profiles, addresses, server-side cart, and orders.
--
-- Money is stored as whole rupees (integer), matching formatPrice() in
-- src/lib/format.ts. Every price in the catalog today is a whole rupee amount.
-- If fractional pricing is ever needed (GST-inclusive odd amounts, discounts),
-- migrate these columns to paise rather than switching to a float.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Empty search_path is deliberate: it stops a caller's search_path from
-- resolving these identifiers to something else.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------

create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  label       text not null,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

comment on table public.categories is
  'Product categories. slug drives /products?category=<slug>.';

create table public.products (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  name         text not null,
  category_id  uuid not null references public.categories (id) on delete restrict,
  price        integer not null check (price > 0),
  description  text not null default '',
  image_path   text not null,
  featured     boolean not null default false,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on column public.products.price is 'Whole rupees.';
comment on column public.products.image_path is
  'Path under /public, e.g. /products/shirts/shirt_01.jpg.';
comment on column public.products.is_active is
  'Soft delete. Hidden from the storefront but kept for order history.';

create index products_category_idx on public.products (category_id);
create index products_featured_idx on public.products (featured) where featured;

create trigger products_touch_updated_at
  before update on public.products
  for each row execute function public.touch_updated_at();

-- One row per size a product is sold in. Separate table (rather than a text[])
-- so stock can be tracked per size, which is how apparel actually sells out.
create table public.product_variants (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products (id) on delete cascade,
  size        text not null,
  sort_order  integer not null default 0,
  stock       integer not null default 0 check (stock >= 0),
  created_at  timestamptz not null default now(),
  unique (product_id, size)
);

create index product_variants_product_idx on public.product_variants (product_id);

-- ---------------------------------------------------------------------------
-- Store settings (single row) — keeps STORE in src/lib/store.ts editable
-- without a redeploy.
-- ---------------------------------------------------------------------------

create table public.store_settings (
  id            boolean primary key default true check (id),
  name          text not null,
  short_name    text not null,
  tagline       text not null,
  address       text not null,
  phone_display text not null,
  phone_href    text not null,
  updated_at    timestamptz not null default now()
);

comment on table public.store_settings is
  'Exactly one row: the boolean primary key with a check constraint makes a
   second row impossible.';

create trigger store_settings_touch_updated_at
  before update on public.store_settings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------------

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text,
  phone      text,
  email      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Public-facing mirror of auth.users. Never expose auth.users to clients.';

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- NOTE: the trigger that auto-creates a profile on signup lives in
-- 20260824000002_auth_profile_trigger.sql. It touches the auth schema, which
-- needs privileges this migration does not require — keeping it separate means
-- a permission failure there cannot roll back everything here. The app also
-- upserts its own profile row on sign-in, so the trigger is an optimisation,
-- not a requirement.

create table public.addresses (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  full_name  text not null,
  phone      text not null,
  line1      text not null,
  city       text not null,
  pin_code   text not null check (pin_code ~ '^[0-9]{6}$'),
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index addresses_user_idx on public.addresses (user_id);

-- At most one default address per customer.
create unique index addresses_one_default_per_user
  on public.addresses (user_id) where is_default;

-- ---------------------------------------------------------------------------
-- Cart — server-side, so it follows the customer across devices
-- ---------------------------------------------------------------------------

create table public.cart_items (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  size       text not null,
  quantity   integer not null default 1 check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, product_id, size)
);

comment on table public.cart_items is
  'The unique constraint on (user_id, product_id, size) lets the client upsert
   and increment instead of read-then-write.';

create index cart_items_user_idx on public.cart_items (user_id);

create trigger cart_items_touch_updated_at
  before update on public.cart_items
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------

create type public.order_status as enum (
  'pending', 'confirmed', 'shipped', 'delivered', 'cancelled'
);

create sequence public.order_number_seq;

create table public.orders (
  id           uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  user_id      uuid not null references auth.users (id) on delete restrict,
  status       public.order_status not null default 'pending',

  -- Shipping details are snapshotted, never joined to addresses: the customer
  -- may edit or delete that address later, and the order must still show where
  -- it was actually sent.
  ship_full_name text not null,
  ship_phone     text not null,
  ship_email     text,
  ship_line1     text not null,
  ship_city      text not null,
  ship_pin_code  text not null,

  subtotal   integer not null check (subtotal >= 0),
  total      integer not null check (total >= 0),

  placed_at  timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_user_idx on public.orders (user_id, placed_at desc);

create trigger orders_touch_updated_at
  before update on public.orders
  for each row execute function public.touch_updated_at();

-- Human-readable order reference, e.g. TM-2026-000017.
create or replace function public.assign_order_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.order_number is null or new.order_number = '' then
    new.order_number := 'TM-'
      || to_char(now(), 'YYYY') || '-'
      || lpad(nextval('public.order_number_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

create trigger orders_assign_order_number
  before insert on public.orders
  for each row execute function public.assign_order_number();

create table public.order_items (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders (id) on delete cascade,

  -- Nullable on purpose: a product can be retired, and the order line must
  -- survive it. The snapshot columns below carry everything needed to render.
  product_id uuid references public.products (id) on delete set null,

  name       text not null,
  slug       text not null,
  size       text not null,
  unit_price integer not null check (unit_price >= 0),
  quantity   integer not null check (quantity > 0),
  image_path text not null
);

comment on table public.order_items is
  'Line items snapshot name/price/image at purchase time, so later catalog
   edits never rewrite order history.';

create index order_items_order_idx on public.order_items (order_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- RLS is enabled on every table. With no policy, a table denies everything —
-- so each table below gets exactly the access it needs and nothing more.
-- ---------------------------------------------------------------------------

alter table public.categories       enable row level security;
alter table public.products         enable row level security;
alter table public.product_variants enable row level security;
alter table public.store_settings   enable row level security;
alter table public.profiles         enable row level security;
alter table public.addresses        enable row level security;
alter table public.cart_items       enable row level security;
alter table public.orders           enable row level security;
alter table public.order_items      enable row level security;

-- Catalog: world-readable, including signed-out visitors browsing the store.
-- Writes are intentionally absent: seeding and admin edits go through the SQL
-- editor or the service_role key, never the browser.

create policy "Categories are public"
  on public.categories for select
  to anon, authenticated
  using (true);

create policy "Active products are public"
  on public.products for select
  to anon, authenticated
  using (is_active);

create policy "Variants of active products are public"
  on public.product_variants for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_variants.product_id and p.is_active
    )
  );

create policy "Store settings are public"
  on public.store_settings for select
  to anon, authenticated
  using (true);

-- Profiles: a customer sees and edits only their own. Insert is allowed for
-- one's own row so the app can create its profile on first sign-in even if the
-- auth trigger migration was never applied.

create policy "Customers read their own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "Customers create their own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "Customers update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Addresses and cart: full ownership of own rows.

create policy "Customers manage their own addresses"
  on public.addresses for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Customers manage their own cart"
  on public.cart_items for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Orders: create and read own. Deliberately no update/delete — a customer
-- must not be able to rewrite an order's total or mark it delivered. Status
-- changes belong to admin tooling running as service_role.

create policy "Customers read their own orders"
  on public.orders for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Customers place their own orders"
  on public.orders for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Customers read their own order items"
  on public.order_items for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.user_id = auth.uid()
    )
  );

create policy "Customers add items to their own orders"
  on public.order_items for insert
  to authenticated
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.user_id = auth.uid()
    )
  );
