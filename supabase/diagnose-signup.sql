-- Why didn't my signup show up?
-- Run in the SQL editor. It reads auth.users directly, so it sees accounts
-- whether or not they got a profile row.

select
  u.email,
  u.created_at,
  u.confirmed_at is not null            as confirmed,
  u.raw_user_meta_data ->> 'full_name'  as name_sent_by_app,
  u.raw_user_meta_data ->> 'role'       as role_sent_by_app,
  p.id is not null                      as has_profile,
  p.full_name                           as name_in_profile,
  p.role                                as role_in_profile
from auth.users u
left join profiles p on p.id = u.id
order by u.created_at desc;

-- How to read the result:
--
-- NO ROWS AT ALL
--   The signup never reached the database. Either the app couldn't connect
--   (wrong URL or key in .env, or Metro wasn't restarted with --clear), or
--   handle_new_user() raised and rolled the whole signup back — which surfaces
--   in the app as "Database error saving new user".
--
-- ROW EXISTS, has_profile = false
--   The trigger didn't fire. Re-run verify.sql check 4.
--
-- ROW EXISTS, has_profile = true
--   Registration worked. You were looking at the wrong table — accounts live
--   in auth.users (Authentication → Users), and only the profile lives in
--   public.profiles (Table Editor).
--
-- ROW EXISTS, confirmed = false
--   Email confirmation is still on. The account is real but has no session,
--   so the app can't sign in with it. Turn confirmations off under
--   Authentication → Sign In / Providers → Email.
