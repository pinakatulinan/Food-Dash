-- 012 — restaurants keep their own opening hours.
--
-- "Open" was a switch someone had to remember to flip. A kitchen that forgets
-- to open loses a morning of orders and assumes the app is broken; one that
-- forgets to close takes an order at 11pm that nobody is there to cook. Both
-- happen in the first week, and both look like your fault.
--
-- restaurants.opens_at / closes_at have existed since schema.sql and were
-- never used. They only allow one pair of times for the whole week, which
-- can't say "closed Sundays", so this replaces them with a row per day. Any
-- values already in those columns are copied across below; the columns are
-- left in place but are now vestigial.

create table if not exists restaurant_hours (
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  -- 0 = Sunday, matching both Postgres extract(dow) and JavaScript getDay(),
  -- so neither side has to remember an offset.
  weekday       int  not null check (weekday between 0 and 6),
  opens_at      time not null,
  closes_at     time not null,
  primary key (restaurant_id, weekday)
);

-- A day with no row is a day they are closed. That makes "closed Sundays" the
-- absence of a row rather than a flag, and it means a brand new restaurant is
-- closed until someone actually sets hours.
alter table restaurant_hours enable row level security;

drop policy if exists "public read hours" on restaurant_hours;
create policy "public read hours" on restaurant_hours for select using (true);

drop policy if exists "owner manages hours" on restaurant_hours;
create policy "owner manages hours" on restaurant_hours for all
  using (restaurant_id in (select id from restaurants where owner_id = auth.uid()));

-- Carry over anything set in the old columns, for all seven days.
insert into restaurant_hours (restaurant_id, weekday, opens_at, closes_at)
select r.id, d.weekday, r.opens_at, r.closes_at
  from restaurants r
  cross join generate_series(0, 6) as d(weekday)
 where r.opens_at is not null and r.closes_at is not null
on conflict do nothing;


-- ============ IS IT OPEN RIGHT NOW ============
/**
 * Both things have to be true: the restaurant intends to trade (is_open, the
 * manual switch) AND the clock is inside today's hours.
 *
 * A restaurant with no hours at all is treated as always in-hours, so this
 * migration cannot silently close everyone who hasn't filled the form in yet.
 * They keep exactly the behaviour they had before.
 *
 * Asia/Manila rather than the server's timezone: the hours a kitchen types are
 * the hours on the wall in Cebu, and the database runs in UTC.
 */
create or replace function restaurant_is_open_now(p_restaurant_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_is_open boolean;
  v_local   timestamp := now() at time zone 'Asia/Manila';
  v_dow     int;
  v_time    time;
  v_row     restaurant_hours%rowtype;
begin
  select is_open into v_is_open from restaurants where id = p_restaurant_id;
  if v_is_open is null or not v_is_open then
    return false;
  end if;

  if not exists (select 1 from restaurant_hours where restaurant_id = p_restaurant_id) then
    return true;   -- no schedule set; the manual switch is the whole answer
  end if;

  v_dow  := extract(dow from v_local)::int;
  v_time := v_local::time;

  select * into v_row
    from restaurant_hours
   where restaurant_id = p_restaurant_id and weekday = v_dow;

  if found then
    -- Same-day hours, e.g. 08:00–20:00.
    if v_row.opens_at <= v_row.closes_at then
      return v_time >= v_row.opens_at and v_time < v_row.closes_at;
    end if;
    -- Hours that run past midnight, e.g. 17:00–02:00. Larsian is a night BBQ
    -- place; treating this as an invalid range would close it every evening.
    return v_time >= v_row.opens_at;
  end if;

  -- Not open today by the schedule — but yesterday's late session may still be
  -- running, so check whether we're inside the tail of it.
  select * into v_row
    from restaurant_hours
   where restaurant_id = p_restaurant_id
     and weekday = (v_dow + 6) % 7          -- yesterday
     and opens_at > closes_at;              -- only sessions that wrap midnight

  if found then
    return v_time < v_row.closes_at;
  end if;

  return false;
end;
$$;

revoke all on function restaurant_is_open_now(uuid) from public, anon;
grant execute on function restaurant_is_open_now(uuid) to anon, authenticated;


-- ============ ENFORCE IT WHERE IT COUNTS ============
-- place_order() already refused orders when is_open was false. The schedule
-- has to be checked in the same place: a phone with a wrong clock, or a stale
-- screen left open since this morning, must not be able to place an order at
-- 3am. The client's own check is only there to explain why the button is off.
create or replace function place_order_open_guard() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not restaurant_is_open_now(new.restaurant_id) then
    raise exception '% is closed right now.',
      (select name from restaurants where id = new.restaurant_id);
  end if;
  return new;
end;
$$;

-- A trigger rather than editing place_order(), so this stays correct no matter
-- how an order gets inserted later.
drop trigger if exists trg_orders_open_guard on orders;
create trigger trg_orders_open_guard
  before insert on orders
  for each row execute function place_order_open_guard();


-- ============ VERIFY ============
select 'restaurant_hours table exists' as check,
       case when to_regclass('public.restaurant_hours') is not null
            then 'PASS' else 'FAIL' end as result
union all
select 'restaurant_is_open_now() exists',
       case when exists (select 1 from pg_proc where proname = 'restaurant_is_open_now')
            then 'PASS' else 'FAIL' end
union all
select 'closed-hours guard installed',
       case when exists (select 1 from pg_trigger where tgname = 'trg_orders_open_guard')
            then 'PASS' else 'FAIL' end;

-- What each restaurant looks like right now.
select r.name,
       r.is_open              as switch_on,
       count(h.weekday)       as days_with_hours,
       restaurant_is_open_now(r.id) as open_now
  from restaurants r
  left join restaurant_hours h on h.restaurant_id = r.id
 group by r.id, r.name, r.is_open
 order by r.name;
