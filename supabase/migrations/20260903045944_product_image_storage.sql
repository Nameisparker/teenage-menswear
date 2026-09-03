-- Product images in Storage, so adding a product stops needing a deploy.
--
-- Until now products.image_path pointed at a file under public/, which meant an
-- admin could only add a product a developer had already shipped an image for.
-- The column keeps its name and its old values still work — see
-- productImageSrc() in src/lib/images.ts, which treats a leading "/" as a
-- public asset and anything else as a key in this bucket.
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- Public read. The bucket being public is what makes the /object/public/ URLs
-- work for signed-out shoppers; this policy is what lets anything list or read
-- the rows behind them.
drop policy if exists "Product images are readable by anyone" on storage.objects;
create policy "Product images are readable by anyone"
  on storage.objects for select
  using (bucket_id = 'product-images');

-- Writes are admin-only, and it is is_admin() doing the deciding here exactly
-- as it does for the products table itself. The upload happens from the
-- browser with the admin's own session, so this policy is the boundary — not
-- the admin layout's redirect.
drop policy if exists "Admins upload product images" on storage.objects;
create policy "Admins upload product images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "Admins replace product images" on storage.objects;
create policy "Admins replace product images"
  on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "Admins delete product images" on storage.objects;
create policy "Admins delete product images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.is_admin());
