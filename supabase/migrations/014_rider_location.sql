-- 014 — live rider location.
--
-- riders.current_lat / current_lng / last_location_at have existed since
-- schema.sql and were never written to. The column grant there already lets a
-- rider update exactly those three and nothing else, so the writing half of
-- this was designed in from the start — what was missing is anything that
-- reads it.
--
-- RLS on riders is "rider reads self", so a customer cannot see a rider row at
-- all. Rather than widen that, the position is copied onto the order the rider
-- is carrying. Three things fall out of that for free:
--
--   * The customer already has SELECT on their own order, so no new policy.
--   * The customer app already subscribes to that row (subscribeToOrder), so
--     realtime delivers each new position with no new channel.
--   * The position is only visible on an order that is actually in progress,
--     which is the same privacy window as order_rider_contact() in 007.

alter table orders
  add column if not exists rider_lat         double precision,
  add column if not exists rider_lng         double precision,
  -- Kept so the customer app can say "last seen 4 minutes ago" rather than
  -- showing a stale dot as though it were live. A frozen marker with no
  -- timestamp is worse than an honest one.
  add column if not exists rider_location_at timestamptz;


/**
 * Reports where the rider is.
 *
 * Security definer because it writes to two tables with different rules, and
 * because the client should not be trusted to decide which order it belongs
 * to — the function works that out from auth.uid().
 *
 * Deliberately silent when the rider has no active delivery: the app stops the
 * watcher on handover, but a last update can always be in flight, and that is
 * not an error worth surfacing to someone on a motorbike.
 */
create or replace function report_rider_location(
  p_lat double precision,
  p_lng double precision
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rider uuid := auth.uid();
begin
  if v_rider is null then
    raise exception 'You must be signed in.';
  end if;

  if p_lat is null or p_lng is null
     or p_lat not between -90 and 90
     or p_lng not between -180 and 180 then
    raise exception 'Invalid coordinates.';
  end if;

  update riders
     set current_lat = p_lat,
         current_lng = p_lng,
         last_location_at = now()
   where id = v_rider;

  if not found then
    raise exception 'Not a rider account.';
  end if;

  -- Only an order this rider is actually carrying. Nothing to update between
  -- jobs, which is the point: a rider waiting for work is not followed.
  update orders
     set rider_lat = p_lat,
         rider_lng = p_lng,
         rider_location_at = now()
   where rider_id = v_rider
     and delivery_status in ('assigned', 'picked_up');
end;
$$;

revoke all on function report_rider_location(double precision, double precision)
  from public, anon;
grant execute on function report_rider_location(double precision, double precision)
  to authenticated;


-- ============ VERIFY ============
select 'location columns on orders' as check,
       case when (select count(*) from information_schema.columns
                   where table_name = 'orders'
                     and column_name in ('rider_lat','rider_lng','rider_location_at')) = 3
            then 'PASS' else 'FAIL' end as result
union all
select 'report_rider_location() exists',
       case when exists (select 1 from pg_proc where proname = 'report_rider_location')
            then 'PASS' else 'FAIL' end
union all
select 'orders is published to realtime',
       case when exists (
         select 1 from pg_publication_tables
          where pubname = 'supabase_realtime' and tablename = 'orders'
       ) then 'PASS' else 'FAIL — the customer map will not update live' end;
