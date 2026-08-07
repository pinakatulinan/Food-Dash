-- 002 — order placement.
--
-- Orders are created ONLY through place_order(). The old insert policies let a
-- client name its own prices: nothing stopped a modified app inserting
-- subtotal_cents = 1 for a ₱500 basket. This function re-prices every line
-- from menu_items and ignores whatever the client claims an item costs.

drop policy if exists "customer creates order" on orders;
drop policy if exists "order items insert" on order_items;

-- The rate lives in the function because the function is now the only thing
-- that creates orders — one source of truth. Existing orders keep the rate
-- snapshotted on their own row, so changing this never rewrites history.
alter table orders alter column rider_commission_rate drop default;

create or replace function place_order(
  p_restaurant_id   uuid,
  p_items           jsonb,   -- [{"menu_item_id": "...", "quantity": 2}, ...]
  p_dropoff_address text,
  p_dropoff_lat     double precision,
  p_dropoff_lng     double precision,
  p_notes           text default null,
  p_payment_method  payment_method default 'cash'
) returns orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer    uuid := auth.uid();
  v_rider_rate  numeric(4,3) := 0.150;   -- your cut of the delivery fee
  v_restaurant  restaurants%rowtype;
  v_requested   int;
  v_matched     int;
  v_subtotal    int;
  v_order       orders%rowtype;
begin
  if v_customer is null then
    raise exception 'You must be signed in to place an order.';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Your basket is empty.';
  end if;

  if p_dropoff_address is null or btrim(p_dropoff_address) = '' then
    raise exception 'A delivery address is required.';
  end if;

  select * into v_restaurant from restaurants where id = p_restaurant_id;
  if not found then
    raise exception 'That restaurant no longer exists.';
  end if;
  if not v_restaurant.is_open then
    raise exception '% is closed right now.', v_restaurant.name;
  end if;

  if exists (
    select 1 from jsonb_to_recordset(p_items) as i(menu_item_id uuid, quantity int)
    where i.quantity is null or i.quantity <= 0
  ) then
    raise exception 'Every item needs a quantity of at least 1.';
  end if;

  -- Every requested line must match an available item belonging to THIS
  -- restaurant. A mismatch means a stale menu or a tampered request; either
  -- way the order is refused rather than silently priced wrong.
  select count(*) into v_requested
  from jsonb_to_recordset(p_items) as i(menu_item_id uuid, quantity int);

  select count(*), coalesce(sum(m.price_cents * i.quantity), 0)
    into v_matched, v_subtotal
  from jsonb_to_recordset(p_items) as i(menu_item_id uuid, quantity int)
  join menu_items m on m.id = i.menu_item_id
  where m.restaurant_id = p_restaurant_id and m.is_available;

  if v_matched <> v_requested then
    raise exception 'Some items are no longer available. Please rebuild your basket.';
  end if;

  insert into orders (
    customer_id, restaurant_id,
    subtotal_cents, delivery_fee_cents,
    restaurant_commission_rate, rider_commission_rate,
    restaurant_payout_cents, rider_payout_cents,
    payment_method, dropoff_address, dropoff_lat, dropoff_lng, notes
  ) values (
    v_customer, p_restaurant_id,
    v_subtotal, v_restaurant.delivery_fee_cents,
    v_restaurant.commission_rate, v_rider_rate,
    -- Mirrors splitOrderMoney() in packages/money: round each party's cut,
    -- the platform keeps the remainder so nothing is lost to rounding.
    v_subtotal - round(v_subtotal * v_restaurant.commission_rate)::int,
    v_restaurant.delivery_fee_cents
      - round(v_restaurant.delivery_fee_cents * v_rider_rate)::int,
    p_payment_method, p_dropoff_address, p_dropoff_lat, p_dropoff_lng,
    nullif(btrim(coalesce(p_notes, '')), '')
  )
  returning * into v_order;

  -- name and price snapshotted, so a later menu edit never rewrites this order
  insert into order_items (order_id, menu_item_id, name_snapshot, price_cents_snapshot, quantity)
  select v_order.id, m.id, m.name, m.price_cents, i.quantity
  from jsonb_to_recordset(p_items) as i(menu_item_id uuid, quantity int)
  join menu_items m on m.id = i.menu_item_id
  where m.restaurant_id = p_restaurant_id and m.is_available;

  return v_order;
end;
$$;

revoke all on function place_order(uuid, jsonb, text, double precision, double precision, text, payment_method)
  from public, anon;
grant execute on function place_order(uuid, jsonb, text, double precision, double precision, text, payment_method)
  to authenticated;
