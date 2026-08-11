-- ===========================================================================
-- Test setup for the customer app work: saved addresses, rider contact,
-- cancel button, basket re-pricing.
--
-- HOW TO RUN THIS
--   Highlight ONE block and press Ctrl+Enter. The Supabase SQL editor runs
--   whatever is selected, or the entire tab if nothing is.
--
--   Blocks 4 and 5 are meant to be run ONE STATEMENT AT A TIME with the app
--   open next to you — the whole point is watching the screen react. Running
--   them in one go is harmless but blows through every state at once and you
--   see nothing.
--
--   Nothing here needs you to paste a uuid. The statements find their own
--   target: the most recently created rider, the most recent order. On a test
--   project that is what you want. To aim at a specific row instead, swap the
--   subquery for a literal id from Block 2.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- BLOCK 1 — confirm the migrations applied. Every row should read PASS.
-- Safe to run any time. Start here.
-- ---------------------------------------------------------------------------
select 'addresses table exists' as check,
       case when to_regclass('public.addresses') is not null
            then 'PASS' else 'FAIL — run migration 006' end as result
union all
select 'one-default index exists',
       case when exists (
         select 1 from pg_indexes
          where tablename = 'addresses' and indexname = 'idx_addresses_one_default'
       ) then 'PASS' else 'FAIL — run migration 006' end
union all
select 'set_default_address() exists',
       case when exists (
         select 1 from pg_proc where proname = 'set_default_address'
       ) then 'PASS' else 'FAIL — run migration 006' end
union all
select 'order_rider_contact() exists',
       case when exists (
         select 1 from pg_proc where proname = 'order_rider_contact'
       ) then 'PASS' else 'FAIL — run migration 007' end
union all
select 'old push objects are gone',
       case when to_regclass('public.push_tokens') is null
            then 'PASS' else 'FAIL — run undo-push-notifications.sql' end;


-- ---------------------------------------------------------------------------
-- BLOCK 2 — what's in the database right now.
-- Read-only. Useful for seeing which rows the blocks below will target.
-- ---------------------------------------------------------------------------
select id, full_name, role, phone, created_at
  from profiles order by created_at desc limit 10;

select o.id, o.order_number, o.status, o.delivery_status, o.total_cents,
       r.name as restaurant, o.created_at
  from orders o join restaurants r on r.id = o.restaurant_id
 order by o.created_at desc limit 10;


-- ---------------------------------------------------------------------------
-- BLOCK 3 — make a rider usable without the rider app.
--
-- FIRST create the auth user by hand, or these update 0 rows and do nothing:
--   Authentication → Users → Add user
--     Email:    rider@test.local     (anything — confirmations are off)
--     Password: anything
--     User metadata (raw JSON):
--       { "full_name": "Juan Rider", "role": "rider" }
--
-- handle_new_user() then creates the profiles row AND the riders row. It
-- cannot set a phone — that comes from the auth user's phone, which email
-- signup leaves null — so it is set here, or the tracking screen shows a
-- rider with no "Call" link.
-- ---------------------------------------------------------------------------
update profiles
   set phone = '+639171234567'
 where id = (select id from profiles
              where role = 'rider' order by created_at desc limit 1);

update riders
   set status = 'approved', approved_at = now()
 where id = (select id from profiles
              where role = 'rider' order by created_at desc limit 1);

-- Confirm it took. Expect one approved rider with a phone.
select p.full_name, p.phone, r.status
  from riders r join profiles p on p.id = r.id
 order by r.id;


-- ---------------------------------------------------------------------------
-- BLOCK 4 — drive the newest order through delivery, one statement at a time.
-- Have the tracking screen open. It is subscribed to this row, so each
-- statement should move the screen with no refresh.
-- ---------------------------------------------------------------------------

-- 4a. Kitchen accepts → the "Cancel order" link disappears.
update orders set status = 'confirmed', confirmed_at = now()
 where id = (select id from orders order by created_at desc limit 1);

-- 4b. Rider takes it → rider card with name + Call link appears.
update orders
   set rider_id = (select id from profiles
                    where role = 'rider' order by created_at desc limit 1),
       delivery_status = 'assigned'
 where id = (select id from orders order by created_at desc limit 1);

-- 4c. Picked up → timeline advances, rider card stays.
update orders set status = 'ready_for_pickup', delivery_status = 'picked_up',
                  picked_up_at = now()
 where id = (select id from orders order by created_at desc limit 1);

-- 4d. Delivered → rider card DISAPPEARS. That is the privacy window closing:
--     order_rider_contact() only answers for 'assigned' and 'picked_up'.
update orders set delivery_status = 'delivered', delivered_at = now()
 where id = (select id from orders order by created_at desc limit 1);


-- ---------------------------------------------------------------------------
-- BLOCK 5 — force a price change, to test the re-pricing notice.
--
-- This one needs you to name an item, because it has to be an item you have
-- actually put in your basket. Replace 'CHANGE THIS ITEM NAME' below with a
-- name from the list. An unmatched name simply updates 0 rows — it will not
-- error — so this block is safe to run before you have edited it.
-- ---------------------------------------------------------------------------
select m.name, m.price_cents, m.is_available, r.name as restaurant
  from menu_items m join restaurants r on r.id = m.restaurant_id
 order by r.name, m.sort_order;

-- Put an item in the basket in the app, leave the basket screen, run this,
-- then reopen the basket → expect "Your basket was updated".
update menu_items set price_cents = price_cents + 1500
 where name = 'CHANGE THIS ITEM NAME';

-- The removal path: reopen the basket and the line should vanish with a note.
update menu_items set is_available = false
 where name = 'CHANGE THIS ITEM NAME';

-- Put it back when you are done.
update menu_items set price_cents = price_cents - 1500, is_available = true
 where name = 'CHANGE THIS ITEM NAME';


-- ---------------------------------------------------------------------------
-- BLOCK 6 — check the saved-address rules hold. Read-only.
-- ---------------------------------------------------------------------------
select id, label, address, is_default, created_at
  from addresses order by created_at desc;

-- Must return 0 rows. Any row here means two addresses claim to be the
-- default for one customer, so the partial unique index from 006 is missing.
select user_id, count(*) as defaults
  from addresses where is_default
 group by user_id having count(*) > 1;