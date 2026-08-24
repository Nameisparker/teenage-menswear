-- Stop trigger functions from being callable as REST RPCs.
--
-- Supabase's security linter flags both of these (lints 0028/0029): they are
-- SECURITY DEFINER, and anything in the `public` schema with EXECUTE granted to
-- anon/authenticated is reachable at /rest/v1/rpc/<name>.
--
-- Both must stay SECURITY DEFINER:
--   handle_new_user      fires as supabase_auth_admin inserting into auth.users,
--                        and needs rights on public.profiles it would not
--                        otherwise have.
--   assign_order_number  calls nextval() on public.order_number_seq, which
--                        customers have no USAGE on.
--
-- A trigger does not consult EXECUTE privileges, so revoking it costs nothing
-- and removes both from the public API surface.

revoke execute on function public.handle_new_user()     from anon, authenticated, public;
revoke execute on function public.assign_order_number() from anon, authenticated, public;

-- add_to_cart and place_order are deliberately left callable: they are the
-- cart/checkout API. Both are SECURITY INVOKER, so RLS still applies and a
-- caller can only ever touch their own rows.
