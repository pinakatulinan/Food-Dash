-- Manual operations for the pilot, until there's an admin UI.
-- Run these one block at a time in the SQL editor — don't run the whole file.

-- ============================================================
-- 1. WHO EXISTS
-- ============================================================
select
  u.email,
  p.full_name,
  p.role,
  r.status  as rider_status,
  r.is_online
from profiles p
join auth.users u on u.id = p.id
left join riders r on r.id = p.id
order by p.created_at desc;


-- ============================================================
-- 2. APPROVE A RIDER  ← do this after a rider signs up
-- ============================================================
-- A rider cannot go online until this runs: riders has a check constraint
-- making is_online = true impossible while status is 'pending'.
update riders
   set status = 'approved', approved_at = now()
 where id = (select id from auth.users where email = 'RIDER@EXAMPLE.COM');


-- ============================================================
-- 3. MAKE SOMEONE A RESTAURANT OWNER
-- ============================================================
-- Needed before advance_order_status() will accept anything from that
-- account — the function checks restaurant ownership.
update restaurants
   set owner_id = (select id from auth.users where email = 'OWNER@EXAMPLE.COM')
 where name = 'Nang Inday''s Kitchen';


-- ============================================================
-- 4. SEE ORDERS
-- ============================================================
select
  o.order_number,
  r.name                as restaurant,
  o.status              as kitchen,
  o.delivery_status     as delivery,
  o.total_cents,
  o.rider_payout_cents,
  o.restaurant_payout_cents,
  o.total_cents - o.rider_payout_cents - o.restaurant_payout_cents as your_cut,
  o.dropoff_address,
  o.created_at
from orders o
join restaurants r on r.id = o.restaurant_id
order by o.created_at desc;


-- ============================================================
-- 5. ADVANCE AN ORDER AS THE KITCHEN
-- ============================================================
-- pending → confirmed → preparing → ready_for_pickup.
-- Riders only see orders at 'confirmed' or later, so run this at least once
-- before expecting anything to appear in the rider app.
--
-- NOTE: these functions read auth.uid(), which is null in the SQL editor, so
-- ownership checks will reject you here. Until the restaurant dashboard
-- exists, move the status directly instead:
update orders
   set status = 'confirmed', confirmed_at = now()
 where order_number = 0;   -- ← put the real order number here

-- The order_events trigger logs this automatically, so the customer's
-- tracking timeline stays correct either way.
