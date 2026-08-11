-- 007 — let a customer see who is bringing their order.
--
-- profiles has exactly one read policy, "own profile read", so a customer
-- cannot see a rider's row at all. That default is correct and worth keeping:
-- widening it would expose whole profile rows to anyone who can guess an id.
--
-- Instead this exposes the two fields the tracking screen needs, for the one
-- order being asked about, and only while a rider is actually carrying it.
-- There is no in-app chat in the MVP by design — phone contact IS the fallback
-- when a rider can't find the gate.

create or replace function order_rider_contact(p_order_id uuid)
returns table (full_name text, phone text)
language sql
security definer
set search_path = public
stable
as $$
  -- riders.id IS the profile id, so this joins straight through to profiles.
  select p.full_name, p.phone
    from orders o
    join profiles p on p.id = o.rider_id
   where o.id = p_order_id
     and o.customer_id = auth.uid()      -- your own order, nobody else's
     and o.rider_id is not null
     -- Readable from the moment a rider takes the job until the food is
     -- handed over. A customer has no reason to keep a rider's personal
     -- number after delivery, so the window closes on its own.
     and o.delivery_status in ('assigned', 'picked_up');
$$;

revoke all on function order_rider_contact(uuid) from public, anon;
grant execute on function order_rider_contact(uuid) to authenticated;