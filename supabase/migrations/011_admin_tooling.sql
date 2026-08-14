-- 011 — admin actions, done from a screen instead of the SQL editor.
--
-- Approving a rider and linking a restaurant owner were both jobs that could
-- only be done by hand in the SQL editor (see pilot-admin.sql). That is fine
-- for three riders and unworkable the moment someone signs up on a Saturday
-- night while you're out.
--
-- Every function here is security definer, because the client is deliberately
-- not allowed to do any of this directly:
--   * schema.sql revokes UPDATE on riders and grants back only is_online and
--     the location columns — precisely so a rider cannot approve themselves.
--   * migration 009 did the same for restaurants, so an owner cannot rewrite
--     their own commission rate.
-- Handing an admin a wider grant would reopen both holes for every account.
-- Instead the specific actions are exposed, and each one checks the caller.

-- ============ WHO IS AN ADMIN ============
-- The admin role has existed in the user_role enum since day one and nothing
-- has ever used it. handle_new_user() whitelists signups to 'customer' and
-- 'rider', so nobody can make themselves an admin — you promote an account by
-- hand, once, with the statement at the bottom of this file.
create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function is_admin() from public, anon;
grant execute on function is_admin() to authenticated;

-- ============ PEOPLE ============
-- Joins auth.users for the email, which no client can read directly. Returns
-- everyone, so it is admin-only and says so on the first line rather than
-- relying on a policy somewhere else to save it.
create or replace function admin_list_people()
returns table (
  id           uuid,
  email        text,
  full_name    text,
  role         user_role,
  phone        text,
  rider_status rider_status,
  is_online    boolean,
  created_at   timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not is_admin() then
    raise exception 'Admins only.';
  end if;

  return query
    select p.id, u.email::text, p.full_name, p.role, p.phone,
           r.status, r.is_online, p.created_at
      from profiles p
      join auth.users u on u.id = p.id
      left join riders r on r.id = p.id
     order by p.created_at desc;
end;
$$;

-- ============ RIDER APPROVAL ============
-- The gate that decides whether someone may carry a stranger's food and hold
-- your cash. A check constraint on riders already makes is_online impossible
-- while status is not 'approved', so suspending someone takes them off the
-- road immediately — this does not need to hunt down their session.
create or replace function admin_set_rider_status(p_rider_id uuid, p_status rider_status)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Admins only.';
  end if;

  update riders
     set status = p_status,
         approved_at = case when p_status = 'approved' then now() else approved_at end,
         -- Taking someone off the road means off the road now, not at the end
         -- of whatever they're doing. The constraint would reject a suspended
         -- rider staying online anyway, so this keeps the row valid.
         is_online = case when p_status = 'approved' then is_online else false end
   where id = p_rider_id;

  if not found then
    raise exception 'No rider with that id.';
  end if;
end;
$$;

-- ============ RESTAURANTS ============
create or replace function admin_list_restaurants()
returns table (
  id          uuid,
  name        text,
  owner_id    uuid,
  owner_email text,
  is_open     boolean,
  commission_rate numeric,
  delivery_fee_cents int
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not is_admin() then
    raise exception 'Admins only.';
  end if;

  return query
    select r.id, r.name, r.owner_id, u.email::text,
           r.is_open, r.commission_rate, r.delivery_fee_cents
      from restaurants r
      left join auth.users u on u.id = r.owner_id
     order by r.name;
end;
$$;

/**
 * Points a restaurant at the account that will run it.
 *
 * Restaurants have no public signup on purpose — a restaurant account accepts
 * orders and is owed money, so it exists only after you have agreed terms.
 * The owner signs up through the customer app like anyone else, and this makes
 * that account the owner.
 */
create or replace function admin_link_restaurant_owner(p_restaurant_id uuid, p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  if not is_admin() then
    raise exception 'Admins only.';
  end if;

  select id into v_user_id from auth.users where lower(email) = lower(trim(p_email));
  if v_user_id is null then
    raise exception 'No account with that email. Ask them to sign up first.';
  end if;

  update restaurants set owner_id = v_user_id where id = p_restaurant_id;
  if not found then
    raise exception 'No restaurant with that id.';
  end if;

  -- Their profile role follows the link, so the account reads as what it is.
  -- Not self-assignable: handle_new_user() only ever allows customer or rider.
  update profiles set role = 'restaurant' where id = v_user_id;
end;
$$;

/** Creates the restaurant row. Commission and fee are commercial terms, so
 *  they are arguments rather than something the restaurant later edits. */
create or replace function admin_create_restaurant(
  p_name               text,
  p_address            text,
  p_lat                double precision default 10.3157,   -- Cebu City
  p_lng                double precision default 123.8854,
  p_commission_rate    numeric default 0.100,
  p_delivery_fee_cents int default 2900
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not is_admin() then
    raise exception 'Admins only.';
  end if;

  insert into restaurants (name, address, lat, lng, commission_rate, delivery_fee_cents)
  values (trim(p_name), trim(p_address), p_lat, p_lng,
          p_commission_rate, p_delivery_fee_cents)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function admin_list_people()                      from public, anon;
revoke all on function admin_set_rider_status(uuid, rider_status) from public, anon;
revoke all on function admin_list_restaurants()                 from public, anon;
revoke all on function admin_link_restaurant_owner(uuid, text)  from public, anon;
revoke all on function admin_create_restaurant(text, text, double precision, double precision, numeric, int)
  from public, anon;

grant execute on function admin_list_people()                      to authenticated;
grant execute on function admin_set_rider_status(uuid, rider_status) to authenticated;
grant execute on function admin_list_restaurants()                 to authenticated;
grant execute on function admin_link_restaurant_owner(uuid, text)  to authenticated;
grant execute on function admin_create_restaurant(text, text, double precision, double precision, numeric, int)
  to authenticated;


-- ============ MAKE YOURSELF AN ADMIN ============
-- Run ONCE, with your own email. Nothing else in the system can grant this,
-- which is the point: there is no path from a signup form to admin.
--
--   update profiles set role = 'admin'
--    where id = (select id from auth.users where email = 'YOU@EXAMPLE.COM');


-- ============ VERIFY ============
select 'is_admin() exists' as check,
       case when exists (select 1 from pg_proc where proname = 'is_admin')
            then 'PASS' else 'FAIL' end as result
union all
select 'admin functions created',
       case when (select count(*) from pg_proc
                   where proname in ('admin_list_people', 'admin_set_rider_status',
                                     'admin_list_restaurants', 'admin_link_restaurant_owner',
                                     'admin_create_restaurant')) = 5
            then 'PASS' else 'FAIL' end
union all
select 'admin accounts',
       coalesce((select count(*)::text from profiles where role = 'admin'), '0')
       || ' — if 0, run the promote statement above with your email';
