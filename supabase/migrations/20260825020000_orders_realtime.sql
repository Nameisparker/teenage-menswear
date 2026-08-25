-- Publish orders for Realtime, so an open admin screen learns about a new order
-- the moment it is placed rather than on the next manual refresh.
--
-- Security note: this does NOT widen who can see what. Realtime evaluates the
-- table's RLS policies against each subscriber, so "Orders are readable by owner
-- or admin" still decides delivery — an admin receives every insert, a customer
-- would only ever receive their own. Publishing a table whose RLS was weak would
-- be a leak; publishing this one is not.
--
-- Only orders is added. order_items carries no signal the notification needs,
-- and every extra published table is extra WAL traffic for every subscriber.

alter publication supabase_realtime add table public.orders;

-- Realtime needs the full old row to evaluate RLS on UPDATE/DELETE. Inserts are
-- complete in the WAL regardless, but the admin list also reflects status
-- changes, and without this those arrive with only the primary key populated.
alter table public.orders replica identity full;
