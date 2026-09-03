-- Two things the database linter found.
--
-- 1. public.rls_auto_enable() had EXECUTE granted to anon and authenticated.
--    It is not exploitable — Postgres refuses to invoke a function returning
--    event_trigger outside its trigger context, and calling it through
--    /rest/v1/rpc gives "cannot display a value of type event_trigger" — but
--    the grant is wrong, and 20260824000004 already revokes exactly this from
--    every other trigger function in the schema.
--
-- 2. product_reviews.user_id had no covering index for its foreign key, so
--    deleting a user scanned the whole table.
--
-- The function and its event trigger are restated here because they were
-- created outside the migration history: the project has them, this repo did
-- not, so a fresh database built from these migrations would have silently had
-- no RLS safety net on new tables. CREATE OR REPLACE keeps the existing
-- definition in place; the point is that the file now describes reality.

create or replace function public.rls_auto_enable()
returns event_trigger
language plpgsql
security definer
set search_path to 'pg_catalog'
as $$
declare
  cmd record;
begin
  for cmd in
    select *
    from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      and object_type in ('table', 'partitioned table')
  loop
    if cmd.schema_name is not null
       and cmd.schema_name in ('public')
       and cmd.schema_name not in ('pg_catalog', 'information_schema')
       and cmd.schema_name not like 'pg_toast%'
       and cmd.schema_name not like 'pg_temp%'
    then
      begin
        execute format(
          'alter table if exists %s enable row level security',
          cmd.object_identity
        );
        raise log 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      exception
        when others then
          raise log 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      end;
    else
      raise log 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)',
        cmd.object_identity, cmd.schema_name;
    end if;
  end loop;
end;
$$;

-- The actual fix. Nothing calls this but the event trigger below.
revoke execute on function public.rls_auto_enable() from anon, authenticated, public;

do $$
begin
  if not exists (select 1 from pg_event_trigger where evtname = 'ensure_rls') then
    create event trigger ensure_rls
      on ddl_command_end
      execute function public.rls_auto_enable();
  end if;
end
$$;

-- Covers product_reviews_user_id_fkey. The existing index leads on product_id
-- (for a product's review list) so it cannot serve a lookup by user.
create index if not exists product_reviews_user_idx
  on public.product_reviews (user_id);
