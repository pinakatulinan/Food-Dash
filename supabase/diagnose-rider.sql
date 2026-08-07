-- Why is the rider app empty?
--
-- A rider only sees an order when ALL of these are true:
--   • the rider is approved
--   • the rider is online
--   • the order has no rider yet   (delivery_status = 'unassigned')
--   • the kitchen has confirmed it (status = confirmed/preparing/ready_for_pickup)
--
-- Run this. The first FAIL is your answer.

select 'orders exist at all' as check_name,
  case when count(*) > 0 then 'PASS — ' || count(*) || ' order(s)'
       else 'FAIL — no orders. Place one in the CUSTOMER app first.' end as result
from orders

union all
select 'order confirmed by kitchen',
  case when count(*) > 0 then 'PASS — ' || count(*) || ' confirmed or later'
       else 'FAIL — every order is still pending. Run the confirm update.' end
from orders where status in ('confirmed', 'preparing', 'ready_for_pickup')

union all
select 'order still unclaimed',
  case when count(*) > 0 then 'PASS — ' || count(*) || ' unclaimed'
       else 'FAIL — all orders already have a rider.' end
from orders where delivery_status = 'unassigned'

union all
select 'visible to riders (all four)',
  case when count(*) > 0 then 'PASS — ' || count(*) || ' order(s) should show'
       else 'FAIL — no order passes both order conditions at once.' end
from orders
where delivery_status = 'unassigned'
  and status in ('confirmed', 'preparing', 'ready_for_pickup')

union all
select 'rider approved',
  case when count(*) > 0 then 'PASS — ' || count(*) || ' approved'
       else 'FAIL — no approved rider. Run the approve update.' end
from riders where status = 'approved'

union all
select 'rider online',
  case when count(*) > 0 then 'PASS — ' || count(*) || ' online'
       else 'FAIL — rider is approved but offline. Flip the toggle in the app.' end
from riders where status = 'approved' and is_online;


-- Detail, if you want to see the actual rows:
-- select order_number, status, delivery_status, rider_id from orders order by created_at desc;
-- select id, status, is_online from riders;
