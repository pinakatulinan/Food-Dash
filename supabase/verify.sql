-- Run this in the Supabase SQL editor AFTER schema.sql and seed.sql.
-- Every row should read PASS. Anything else tells you exactly what's missing.
--
-- Checks 9 and 10 only mean something once you've created a test user under
-- Authentication → Users — that's the real test of the signup trigger.

with checks as (

  select 1 as ord, 'tables created' as check_name,
    case when count(*) = 7 then 'PASS'
         else 'FAIL — found ' || count(*) || ' of 7' end as result
  from information_schema.tables
  where table_schema = 'public'
    and table_name in ('profiles', 'restaurants', 'menu_items', 'riders',
                       'orders', 'order_items', 'order_events')

  union all
  select 2, 'enum types created',
    case when count(*) = 5 then 'PASS'
         else 'FAIL — found ' || count(*) || ' of 5' end
  from pg_type
  where typname in ('user_role', 'order_status', 'payment_method',
                    'payment_status', 'rider_status')

  union all
  select 3, 'row level security enabled',
    case when count(*) = 7 then 'PASS'
         else 'FAIL — only ' || count(*) || ' of 7 tables have RLS on' end
  from pg_tables
  where schemaname = 'public' and rowsecurity
    and tablename in ('profiles', 'restaurants', 'menu_items', 'riders',
                      'orders', 'order_items', 'order_events')

  union all
  select 4, 'signup trigger on auth.users',
    case when count(*) = 1 then 'PASS'
         else 'FAIL — trg_new_user missing; signups will not create profiles' end
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'auth' and c.relname = 'users' and t.tgname = 'trg_new_user'

  union all
  select 5, 'rider approval gate',
    case when count(*) = 1 then 'PASS'
         else 'FAIL — unapproved riders could go online' end
  from pg_constraint
  where conname = 'rider_online_requires_approval'

  union all
  -- If this fails, a customer can promote themselves to admin.
  select 6, 'profiles: role column locked',
    case when count(*) = 2 then 'PASS'
         else 'FAIL — authenticated can update ' || count(*)
              || ' columns, expected 2 (full_name, phone)' end
  from information_schema.column_privileges
  where table_schema = 'public' and table_name = 'profiles'
    and grantee = 'authenticated' and privilege_type = 'UPDATE'

  union all
  -- If this fails, a rider can approve themselves.
  select 7, 'riders: status column locked',
    case when count(*) = 4 then 'PASS'
         else 'FAIL — authenticated can update ' || count(*)
              || ' columns, expected 4' end
  from information_schema.column_privileges
  where table_schema = 'public' and table_name = 'riders'
    and grantee = 'authenticated' and privilege_type = 'UPDATE'

  union all
  select 8, 'seed data loaded',
    case when (select count(*) from restaurants) = 3
          and (select count(*) from menu_items) = 10 then 'PASS'
         else 'FAIL — expected 3 restaurants and 10 menu items, found '
              || (select count(*) from restaurants) || ' and '
              || (select count(*) from menu_items) end

  union all
  select 9, 'every auth user has a profile',
    case when (select count(*) from auth.users) = 0
           then 'SKIP — create a test user under Authentication → Users'
         when count(*) = 0 then 'PASS'
         else 'FAIL — ' || count(*) || ' user(s) with no profile row' end
  from auth.users u
  left join profiles p on p.id = u.id
  where p.id is null

  union all
  select 10, 'rider signups get a rider row',
    case when (select count(*) from profiles where role = 'rider') = 0
           then 'SKIP — no rider accounts yet'
         when count(*) = 0 then 'PASS'
         else 'FAIL — ' || count(*) || ' rider profile(s) with no rider row' end
  from profiles pr
  left join riders r on r.id = pr.id
  where pr.role = 'rider' and r.id is null

)
select check_name, result from checks order by ord;
