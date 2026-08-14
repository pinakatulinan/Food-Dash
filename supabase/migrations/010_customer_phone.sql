-- 010 — customers get a phone number, and riders can see it.
--
-- Two holes that only show up on a doorstep:
--
--   1. Customer signup collected a name, email and password. profiles.phone
--      was filled from auth.users.phone, which is null for an email signup —
--      so every customer in the database is unreachable.
--   2. Nothing exposed a customer's contact details to the rider carrying
--      their food anyway.
--
-- The MVP deliberately has no in-app chat, on the grounds that people can use
-- the phone. That only works if there is a phone number.

-- ============ TAKE THE PHONE FROM SIGNUP ============
-- Unchanged from schema.sql apart from the phone line. auth.users.phone is
-- still preferred: it's null today, but it becomes the authoritative,
-- *verified* number the moment phone OTP replaces email+password, and this
-- should start using it automatically when that happens rather than needing
-- another migration.
create or replace function handle_new_user() returns trigger as $$
declare
  requested_role text := new.raw_user_meta_data ->> 'role';
begin
  insert into profiles (id, role, full_name, phone)
  values (
    new.id,
    case
      when requested_role in ('customer', 'rider') then requested_role::user_role
      else 'customer'::user_role
    end,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(
      new.phone,                                              -- verified, once OTP lands
      nullif(trim(new.raw_user_meta_data ->> 'phone'), '')     -- typed at signup, unverified
    )
  );

  -- Riders get their rider row up front, but start 'pending': the check
  -- constraint on riders means they cannot go online until you approve them.
  if requested_role = 'rider' then
    insert into riders (id) values (new.id);
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- No column grant needed for customers to fix their own number later:
-- schema.sql already has `grant update (full_name, phone) on profiles`, so a
-- user may edit those two fields and nothing else.

-- ============ LET THE RIDER CALL THE CUSTOMER ============
-- The mirror image of order_rider_contact() from migration 007, and
-- deliberately the same shape: profiles stays readable only by its owner, and
-- this exposes exactly two fields, for one order, to one person, for the part
-- of the delivery where they need them.
create or replace function order_customer_contact(p_order_id uuid)
returns table (full_name text, phone text)
language sql
security definer
set search_path = public
stable
as $$
  select p.full_name, p.phone
    from orders o
    join profiles p on p.id = o.customer_id
   where o.id = p_order_id
     and o.rider_id = auth.uid()          -- only the rider actually carrying it
     -- Opens when they claim the order and closes on handover. A rider has no
     -- reason to keep a customer's number after the food is delivered.
     and o.delivery_status in ('assigned', 'picked_up');
$$;

revoke all on function order_customer_contact(uuid) from public, anon;
grant execute on function order_customer_contact(uuid) to authenticated;


-- ============ VERIFY ============
select 'handle_new_user reads metadata phone' as check,
       case when pg_get_functiondef('handle_new_user()'::regprocedure)
                 like '%raw_user_meta_data ->> ''phone''%'
            then 'PASS' else 'FAIL' end as result
union all
select 'order_customer_contact() exists',
       case when exists (
         select 1 from pg_proc where proname = 'order_customer_contact'
       ) then 'PASS' else 'FAIL' end
union all
select 'customers still missing a phone',
       coalesce((
         select count(*)::text from profiles
          where role = 'customer' and (phone is null or phone = '')
       ), '0') || ' — they are asked at their next checkout';
