-- Auto-create a profile row on signup.
--
-- SEPARATE MIGRATION ON PURPOSE. Creating a trigger on auth.users requires
-- ownership of that table, which the role running your SQL may not have. The
-- Supabase SQL editor runs a pasted batch as a single transaction, so if this
-- failed while bundled with the schema, the entire schema would roll back.
--
-- Apply this file on its own, AFTER 20260824000000_init_schema.sql. If it fails
-- with "must be owner of relation users", that is fine and nothing else breaks:
-- the app upserts its own profile row on sign-in, and profiles has an insert
-- policy for exactly that. You can safely skip this file.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Pull whatever the provider gave us: Google supplies full_name and email,
  -- phone OTP supplies phone.
  insert into public.profiles (id, full_name, phone, email)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    ),
    new.phone,
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
