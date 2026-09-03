-- Extra angles for a product.
--
-- products.image_path stays the cover and is left alone: it is what the cards,
-- the cart, the order items snapshot and every admin table read, and moving all
-- of that into a join to gain a second photo would be a large change for a
-- small feature. This table holds the *additional* images, and the product page
-- shows the cover followed by these.
--
-- Deleting a product cascades these rows away but not the objects in Storage.
-- Sweeping orphaned objects is a separate job; an unreferenced file costs a
-- fraction of a cent and deleting one that is still in use costs a product its
-- picture.
create table public.product_images (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products (id) on delete cascade,
  image_path  text not null,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  -- The same file twice in one gallery is always a mistake.
  unique (product_id, image_path)
);

comment on table public.product_images is
  'Additional images for a product, shown after products.image_path. Paths
   follow the same convention as that column: a bucket key, or a path under
   public/ — see productImageSrc() in src/lib/images.ts.';

create index product_images_product_idx
  on public.product_images (product_id, sort_order);

alter table public.product_images enable row level security;

-- Same shape as product_variants in 20260825010000: public read gated on the
-- parent being active, and a separate admin read so an admin can still see the
-- gallery of a hidden product.
create policy "Images of active products are public"
  on public.product_images for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_images.product_id and p.is_active
    )
  );

create policy "Admins read all product images"
  on public.product_images for select
  to authenticated
  using ((select public.is_admin()));

create policy "Admins insert product images"
  on public.product_images for insert
  to authenticated
  with check ((select public.is_admin()));

create policy "Admins update product images"
  on public.product_images for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Admins delete product images"
  on public.product_images for delete
  to authenticated
  using ((select public.is_admin()));
