-- Food-Dash — Supabase schema
-- Run in Supabase SQL editor. Assumes Supabase Auth manages auth.users.

-- ============ ENUMS ============
create type user_role as enum ('customer', 'rider', 'restaurant', 'admin');
create type order_status as enum (
  'pending',        -- placed, awaiting restaurant confirmation
  'confirmed',      -- restaurant accepted
  'preparing',
  'ready_for_pickup',
  'rider_assigned',
  'picked_up',
  'delivered',
  'cancelled'
);
create type payment_method as enum ('gcash', 'maya', 'card', 'cash');
create type payment_status as enum ('pending', 'paid', 'refunded', 'failed');
-- Riders sign up freely but are vetted by hand before they can work.
create type rider_status as enum ('pending', 'approved', 'suspended');

-- ============ PROFILES ============
-- Extends Supabase auth.users
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'customer',
  full_name text not null,
  phone text,
  created_at timestamptz not null default now()
);

-- ============ RESTAURANTS ============
create table restaurants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id),
  name text not null,
  description text,
  address text not null,
  lat double precision not null,
  lng double precision not null,
  is_open boolean not null default false,
  opens_at time,
  closes_at time,
  prep_minutes int not null default 20,   -- avg kitchen prep time
  -- Flat per restaurant for the pilot. Distance-based pricing would use the
  -- lat/lng above plus the customer's dropoff.
  delivery_fee_cents int not null default 2900 check (delivery_fee_cents >= 0),
  -- Negotiated per restaurant; copied onto each order as
  -- orders.restaurant_commission_rate at order time.
  commission_rate numeric(4,3) not null default 0.100,
  created_at timestamptz not null default now()
);

create table menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  category text not null default 'Meals',
  name text not null,
  description text,
  price_cents int not null check (price_cents >= 0),  -- store money as integer centavos
  is_available boolean not null default true,
  sort_order int not null default 0
);

-- ============ RIDERS ============
-- Signing up and being allowed to work are two different things. A rider
-- holds a customer's food and, on COD orders, your cash — so approval is
-- manual and the database, not the app, enforces the gate.
create table riders (
  id uuid primary key references profiles(id) on delete cascade,
  status rider_status not null default 'pending',
  approved_at timestamptz,
  vehicle_type text not null default 'motorcycle',
  plate_number text,
  license_number text,
  -- Supabase Storage object paths, reviewed by hand before approval
  license_photo_path text,
  or_cr_photo_path text,
  selfie_path text,
  is_online boolean not null default false,
  current_lat double precision,
  current_lng double precision,
  last_location_at timestamptz,
  -- An unapproved rider can never be online, whatever the app sends.
  constraint rider_online_requires_approval
    check (not is_online or status = 'approved')
);

-- ============ ORDERS ============
create table orders (
  id uuid primary key default gen_random_uuid(),
  order_number serial,                       -- human-friendly #1042
  customer_id uuid not null references profiles(id),
  restaurant_id uuid not null references restaurants(id),
  rider_id uuid references riders(id),
  status order_status not null default 'pending',
  -- Money (all in centavos)
  subtotal_cents int not null,
  delivery_fee_cents int not null,
  total_cents int generated always as (subtotal_cents + delivery_fee_cents) stored,
  -- You take a cut of both the food and the delivery fee. Both rates are
  -- snapshotted here at order time so changing your rates later never
  -- rewrites what an old order paid out. See splitOrderMoney() in
  -- packages/money — that function is the only implementation of the split.
  -- Restaurant rate is negotiated per restaurant and copied from
  -- restaurants.commission_rate. The rider rate is platform-wide: changing
  -- this default only affects future orders, which is the whole point.
  restaurant_commission_rate numeric(4,3) not null,           -- on subtotal_cents
  rider_commission_rate numeric(4,3) not null default 0.150,  -- on delivery_fee_cents
  restaurant_payout_cents int not null,      -- subtotal minus your cut
  rider_payout_cents int not null,           -- delivery fee minus your cut
  -- Payment
  payment_method payment_method not null default 'cash',
  payment_status payment_status not null default 'pending',
  paymongo_ref text,
  -- Delivery
  dropoff_address text not null,
  -- Optional: checkout takes a free-text address and the rider app hands it
  -- to Google Maps as text. Required again once there's an address picker.
  dropoff_lat double precision,
  dropoff_lng double precision,
  notes text,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  menu_item_id uuid not null references menu_items(id),
  name_snapshot text not null,               -- name at time of order
  price_cents_snapshot int not null,
  quantity int not null check (quantity > 0)
);

-- Status history for the tracking timeline
create table order_events (
  id bigserial primary key,
  order_id uuid not null references orders(id) on delete cascade,
  status order_status not null,
  created_at timestamptz not null default now()
);

-- ============ INDEXES ============
create index idx_orders_customer on orders(customer_id, created_at desc);
create index idx_orders_restaurant_status on orders(restaurant_id, status);
create index idx_orders_rider on orders(rider_id, status);
create index idx_menu_items_restaurant on menu_items(restaurant_id, sort_order);
create index idx_riders_online on riders(is_online) where is_online = true;

-- ============ ROW LEVEL SECURITY ============
alter table profiles enable row level security;
alter table restaurants enable row level security;
alter table menu_items enable row level security;
alter table riders enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table order_events enable row level security;

-- Everyone can browse restaurants and menus
create policy "public read restaurants" on restaurants for select using (true);
create policy "public read menu" on menu_items for select using (true);

-- Users see and edit their own profile
create policy "own profile read" on profiles for select using (auth.uid() = id);
create policy "own profile update" on profiles for update using (auth.uid() = id);

-- There is deliberately NO insert policy on profiles. Rows are created only
-- by handle_new_user() below, so a client can never pick its own role.

-- ---- Column privileges ----
-- RLS decides which ROWS a user may touch; these decide which COLUMNS.
-- Without them "own profile update" lets a customer set their own role to
-- 'admin', and "rider updates self" lets a rider approve themselves.
revoke update on profiles from anon, authenticated;
grant update (full_name, phone) on profiles to authenticated;

revoke update on riders from anon, authenticated;
grant update (is_online, current_lat, current_lng, last_location_at)
  on riders to authenticated;

-- Customers see their own orders; restaurant owners see theirs; riders see assigned
create policy "customer reads own orders" on orders for select
  using (auth.uid() = customer_id);
create policy "restaurant reads its orders" on orders for select
  using (auth.uid() in (select owner_id from restaurants where id = restaurant_id));
create policy "rider reads assigned orders" on orders for select
  using (auth.uid() = rider_id);
create policy "customer creates order" on orders for insert
  with check (auth.uid() = customer_id);

-- Order items follow the parent order's visibility
create policy "order items via parent" on order_items for select
  using (order_id in (select id from orders));
create policy "order items insert" on order_items for insert
  with check (order_id in (select id from orders where customer_id = auth.uid()));

create policy "order events via parent" on order_events for select
  using (order_id in (select id from orders));

-- Restaurant owners manage their menu
create policy "owner manages menu" on menu_items for all
  using (restaurant_id in (select id from restaurants where owner_id = auth.uid()));

-- Riders update their own record (location, online status)
create policy "rider reads self" on riders for select using (auth.uid() = id);
create policy "rider updates self" on riders for update using (auth.uid() = id);

-- NOTE: status transitions (confirm, assign rider, mark delivered) should go
-- through Postgres functions / Edge Functions with service role, not direct
-- client updates. Add those as you build each flow.

-- ============ HELPER: give every new auth user a profile ============
-- Supabase Auth only ever writes to auth.users. Without this trigger a user
-- signs up successfully, gets a valid session, and has no profile — no role,
-- no name — so every policy and query above quietly finds nothing.
--
-- security definer because profiles has no insert policy, and that is the
-- point: the client must never choose its own role. Only 'customer' and
-- 'rider' can be self-assigned. Restaurant and admin accounts are created by
-- hand, because a restaurant account can accept orders and is owed money.
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
    new.phone
  );

  -- Riders get their rider row up front, but start 'pending': the check
  -- constraint on riders means they cannot go online until you approve them.
  if requested_role = 'rider' then
    insert into riders (id) values (new.id);
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_new_user
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============ HELPER: auto-log status changes ============
create or replace function log_order_event() returns trigger as $$
begin
  if (tg_op = 'INSERT') or (new.status is distinct from old.status) then
    insert into order_events (order_id, status) values (new.id, new.status);
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_order_events
  after insert or update of status on orders
  for each row execute function log_order_event();
