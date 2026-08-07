-- 006 — push notifications for riders.
--
-- Realtime already keeps the rider's list fresh, but only while they're
-- looking at it. A rider waiting for food isn't watching a screen, so orders
-- sit unclaimed. This pushes a notification the moment a restaurant confirms.
--
-- Sending happens straight from Postgres via pg_net, so there's no Edge
-- Function to deploy and no Supabase CLI needed.

create extension if not exists pg_net;

-- ============ TOKENS ============
create table if not exists push_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  token      text not null unique,
  platform   text,
  updated_at timestamptz not null default now()
);

create index if not exists idx_push_tokens_user on push_tokens (user_id);

alter table push_tokens enable row level security;

-- A device may only register or remove its own token.
drop policy if exists "own push tokens" on push_tokens;
create policy "own push tokens" on push_tokens for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============ NOTIFY RIDERS ON CONFIRMATION ============
-- Fires when an order first becomes claimable: the kitchen has confirmed it
-- and no rider has taken it. Only approved, online riders are told, which
-- mirrors exactly who the RLS policy lets see the order anyway.
create or replace function notify_riders_of_order() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tokens     text[];
  v_restaurant text;
  v_payout     text;
begin
  if new.status <> 'confirmed' or new.delivery_status <> 'unassigned' then
    return new;
  end if;

  -- Only on the transition into 'confirmed', never on later edits.
  if tg_op = 'UPDATE' and old.status = new.status then
    return new;
  end if;

  select array_agg(distinct t.token) into v_tokens
  from push_tokens t
  join riders r on r.id = t.user_id
  where r.status = 'approved' and r.is_online;

  if v_tokens is null or cardinality(v_tokens) = 0 then
    return new;   -- nobody online; the order still shows on next refresh
  end if;

  select name into v_restaurant from restaurants where id = new.restaurant_id;
  v_payout := to_char(new.rider_payout_cents / 100.0, 'FM999990.00');

  -- Expo accepts a batch of messages in one call.
  perform net.http_post(
    url     := 'https://exp.host/--/api/v2/push/send',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body    := (
      select jsonb_agg(jsonb_build_object(
        'to',       tok,
        'title',    'New order available',
        'body',     coalesce(v_restaurant, 'A restaurant') || ' · ₱' || v_payout,
        'data',     jsonb_build_object('orderId', new.id),
        'sound',    'default',
        'priority', 'high',
        'channelId','orders'
      ))
      from unnest(v_tokens) as tok
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_riders on orders;
create trigger trg_notify_riders
  after insert or update of status on orders
  for each row execute function notify_riders_of_order();
