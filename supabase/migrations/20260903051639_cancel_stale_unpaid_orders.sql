-- Give back stock that an abandoned payment is sitting on.
--
-- place_order holds stock from the moment an order exists, prepaid included,
-- because an order someone might still pay for must not be sellable twice.
-- The cost of that choice is a Razorpay order nobody completes holding its
-- units indefinitely. This releases them.
--
-- Cancelling is all it has to do: the existing triggers do the rest —
-- restore_stock_on_cancel returns the units, log_order_status writes the
-- 'cancelled' event the customer's tracking timeline reads.
create extension if not exists pg_cron;

create or replace function public.cancel_stale_unpaid_orders(
  p_older_than interval default interval '30 minutes'
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  with stale as (
    update public.orders
       set status = 'cancelled'
     where payment_method = 'razorpay'
       and payment_status <> 'paid'
       and status = 'pending'
       and placed_at < now() - p_older_than
    returning 1
  )
  select count(*) into v_count from stale;

  return v_count;
end;
$$;

-- Nobody calls this but the scheduler. An admin cancelling one order does it
-- through the status control like any other status change.
revoke execute on function public.cancel_stale_unpaid_orders(interval)
  from anon, authenticated, public;

-- Every ten minutes, not every minute: the window is half an hour, so a tighter
-- schedule only adds wake-ups.
select cron.unschedule('cancel-stale-unpaid-orders')
where exists (
  select 1 from cron.job where jobname = 'cancel-stale-unpaid-orders'
);

select cron.schedule(
  'cancel-stale-unpaid-orders',
  '*/10 * * * *',
  $$select public.cancel_stale_unpaid_orders()$$
);
