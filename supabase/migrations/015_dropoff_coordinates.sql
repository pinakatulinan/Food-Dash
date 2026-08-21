-- 015 — saved addresses remember their pin.
--
-- orders.dropoff_lat / dropoff_lng have existed since schema.sql, and
-- place_order() has always accepted them — the app just sent null, because
-- checkout captured a typed address and nothing else. Migration 003 made those
-- columns nullable for exactly that reason and said to make them required
-- again "once there's a real address picker". This is that picker's half of
-- the bargain.
--
-- Without coordinates the customer app can only measure a rider against the
-- restaurant, because that is the only point on the trip it has numbers for.
-- "McDo Linao" is eleven characters, not a location.

alter table addresses
  add column if not exists lat double precision,
  add column if not exists lng double precision;

-- Nullable, because every address saved before today has no pin. Those keep
-- working as text — the customer is asked to drop one next time they use it,
-- rather than being locked out of an address they already trusted.

comment on column addresses.lat is
  'Dropped by the customer at checkout. Null for addresses saved before 015.';


-- ============ VERIFY ============
select 'addresses has coordinates' as check,
       case when (select count(*) from information_schema.columns
                   where table_name = 'addresses' and column_name in ('lat','lng')) = 2
            then 'PASS' else 'FAIL' end as result
union all
select 'orders already accepts them',
       case when (select count(*) from information_schema.columns
                   where table_name = 'orders'
                     and column_name in ('dropoff_lat','dropoff_lng')) = 2
            then 'PASS' else 'FAIL' end
union all
select 'saved addresses still missing a pin',
       coalesce((select count(*)::text from addresses where lat is null), '0')
       || ' — each is asked for one next time it is used';
