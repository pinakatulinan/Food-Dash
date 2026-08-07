-- 004 — order transitions.
--
-- An order has two lifecycles running side by side: the kitchen's and the
-- rider's. Forcing both onto one column created a false ordering — with
-- dispatch happening at confirmation, a rider is assigned while the food is
-- still cooking, so 'rider_assigned' cannot sit after 'preparing' on a single
-- line. Two columns, two owners, no contradiction.
--
--   status           pending → confirmed → preparing → ready_for_pickup   (restaurant)
--   delivery_status  unassigned → assigned → picked_up → delivered        (rider)
--
-- The unused 'rider_assigned' and 'picked_up' values on order_status are now
-- dead; Postgres can't drop enum values, and they're harmless.

create type delivery_status as enum ('unassigned', 'assigned', 'picked_up', 'delivered');

alter table orders
  add column if not exists delivery_status delivery_status not null default 'unassigned',
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references profiles(id),
  add column if not exists cancellation_reason text;

-- The rider pool query, which runs on every refresh of the rider app.
create index if not exists idx_orders_available on orders (created_at)
  where delivery_status = 'unassigned'
    and status in ('confirmed', 'preparing', 'ready_for_pickup');

-- ============ POLICIES ============

-- Without this the rider app is permanently empty: the existing policy only
-- shows a rider orders already assigned to them, but an unclaimed order by
-- definition has no rider yet. Approved and online only — an unvetted rider
-- never even sees the pool.
drop policy if exists "rider reads available orders" on orders;
create policy "rider reads available orders" on orders for select
using (
  delivery_status = 'unassigned'
  and status in ('confirmed', 'preparing', 'ready_for_pickup')
  and exists (
    select 1 from riders r
    where r.id = auth.uid() and r.status = 'approved' and r.is_online
  )
);

-- Still no UPDATE policy on orders, deliberately. Every state change goes
-- through the functions below, which check who is asking.

-- ============ RESTAURANT: advance the food ============

create or replace function advance_order_status(p_order_id uuid) returns orders
language plpgsql security definer set search_path = public
as $$
declare
  v_order orders%rowtype;
  v_next  order_status;
begin
  select * into v_order from orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found.';
  end if;

  if not exists (
    select 1 from restaurants
    where id = v_order.restaurant_id and owner_id = auth.uid()
  ) then
    raise exception 'That order belongs to another restaurant.';
  end if;

  v_next := case v_order.status
    when 'pending'    then 'confirmed'::order_status
    when 'confirmed'  then 'preparing'::order_status
    when 'preparing'  then 'ready_for_pickup'::order_status
    else null
  end;

  if v_next is null then
    raise exception 'This order is already %.', v_order.status;
  end if;

  update orders
     set status = v_next,
         confirmed_at = case when v_next = 'confirmed' then now() else confirmed_at end
   where id = p_order_id
   returning * into v_order;

  return v_order;
end;
$$;

-- ============ RESTAURANT or CUSTOMER: cancel ============

create or replace function cancel_order(p_order_id uuid, p_reason text default null)
returns orders
language plpgsql security definer set search_path = public
as $$
declare
  v_order    orders%rowtype;
  v_is_owner boolean;
begin
  select * into v_order from orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found.';
  end if;

  if v_order.status in ('delivered', 'cancelled') then
    raise exception 'This order is already %.', v_order.status;
  end if;

  select exists (
    select 1 from restaurants
    where id = v_order.restaurant_id and owner_id = auth.uid()
  ) into v_is_owner;

  -- A customer may back out only while the kitchen hasn't accepted yet.
  -- After that it's the restaurant's call, because food may already be cooking.
  if v_order.customer_id = auth.uid() then
    if v_order.status <> 'pending' then
      raise exception 'The restaurant has already started this order. Please call them.';
    end if;
  elsif not v_is_owner then
    raise exception 'You cannot cancel this order.';
  end if;

  update orders
     set status = 'cancelled',
         cancelled_at = now(),
         cancelled_by = auth.uid(),
         cancellation_reason = nullif(btrim(coalesce(p_reason, '')), '')
   where id = p_order_id
   returning * into v_order;

  return v_order;
end;
$$;

-- ============ RIDER: claim an order ============

create or replace function accept_order(p_order_id uuid) returns orders
language plpgsql security definer set search_path = public
as $$
declare
  v_rider riders%rowtype;
  v_order orders%rowtype;
begin
  select * into v_rider from riders where id = auth.uid();
  if not found then
    raise exception 'Only riders can accept orders.';
  end if;
  if v_rider.status <> 'approved' then
    raise exception 'Your rider account is still pending approval.';
  end if;
  if not v_rider.is_online then
    raise exception 'Go online before accepting orders.';
  end if;

  -- The atomic claim. Testing delivery_status inside the UPDATE rather than
  -- reading it first means two riders tapping Accept in the same instant
  -- cannot both win — the second one updates zero rows and is told so.
  update orders
     set rider_id = v_rider.id,
         delivery_status = 'assigned'
   where id = p_order_id
     and delivery_status = 'unassigned'
     and status in ('confirmed', 'preparing', 'ready_for_pickup')
   returning * into v_order;

  if not found then
    raise exception 'That order has already been taken.';
  end if;

  return v_order;
end;
$$;

-- ============ RIDER: advance the delivery ============

create or replace function advance_delivery(p_order_id uuid) returns orders
language plpgsql security definer set search_path = public
as $$
declare
  v_order orders%rowtype;
  v_next  delivery_status;
begin
  select * into v_order from orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found.';
  end if;

  if v_order.rider_id is distinct from auth.uid() then
    raise exception 'That delivery belongs to another rider.';
  end if;

  v_next := case v_order.delivery_status
    when 'assigned'  then 'picked_up'::delivery_status
    when 'picked_up' then 'delivered'::delivery_status
    else null
  end;

  if v_next is null then
    raise exception 'This delivery is already %.', v_order.delivery_status;
  end if;

  -- A rider can be at the restaurant before the food is, but can't leave with
  -- an order the kitchen hasn't finished.
  if v_next = 'picked_up' and v_order.status <> 'ready_for_pickup' then
    raise exception 'The kitchen has not marked this order ready yet.';
  end if;

  update orders
     set delivery_status = v_next,
         picked_up_at = case when v_next = 'picked_up' then now() else picked_up_at end,
         delivered_at = case when v_next = 'delivered' then now() else delivered_at end,
         -- Handing the food over completes the order outright.
         status = case when v_next = 'delivered' then 'delivered'::order_status else status end
   where id = p_order_id
   returning * into v_order;

  return v_order;
end;
$$;

-- ============ GRANTS ============
-- Signed-in callers only; each function decides for itself who may act.

revoke all on function advance_order_status(uuid) from public, anon;
revoke all on function cancel_order(uuid, text)     from public, anon;
revoke all on function accept_order(uuid)           from public, anon;
revoke all on function advance_delivery(uuid)       from public, anon;

grant execute on function advance_order_status(uuid) to authenticated;
grant execute on function cancel_order(uuid, text)   to authenticated;
grant execute on function accept_order(uuid)         to authenticated;
grant execute on function advance_delivery(uuid)     to authenticated;
