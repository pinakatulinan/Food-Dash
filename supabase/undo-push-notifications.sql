-- Teardown for migration 006 (push notifications).
--
-- Run this ONCE in the Supabase SQL editor. It is deliberately not a numbered
-- migration: 006 has been deleted from the repo, so a fresh setup running
-- schema.sql + 001-005 never creates any of this, and a 007 that dropped it
-- would just fail confusingly against a clean database.
--
-- Order matters. The trigger depends on the function, so it goes first; the
-- RLS policy and the user index live on the table and disappear with it.

drop trigger if exists trg_notify_riders on orders;

drop function if exists notify_riders_of_order();

-- Takes "own push tokens" (policy) and idx_push_tokens_user (index) with it.
drop table if exists push_tokens;

-- Deliberately NOT dropping the pg_net extension. Migration 006 used
-- `create extension if not exists`, so there is no way to tell whether it
-- created pg_net or found it already enabled — Supabase enables it on many
-- projects by default. Leaving it costs nothing and dropping something
-- another feature depends on is the more expensive mistake.
--
-- If you are certain nothing else uses it:  drop extension pg_net;


-- ============ VERIFY ============
-- Every row should read PASS. Run after the drops above.
select 'push_tokens table removed' as check,
       case when to_regclass('public.push_tokens') is null
            then 'PASS' else 'FAIL' end as result
union all
select 'notify_riders_of_order() removed',
       case when not exists (
         select 1 from pg_proc where proname = 'notify_riders_of_order'
       ) then 'PASS' else 'FAIL' end
union all
select 'trg_notify_riders trigger removed',
       case when not exists (
         select 1 from pg_trigger where tgname = 'trg_notify_riders'
       ) then 'PASS' else 'FAIL' end;

