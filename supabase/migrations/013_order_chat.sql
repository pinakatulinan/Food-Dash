-- 013 — in-app chat between customer and rider.
--
-- 007 and 010 chose phone contact over chat for the MVP, on the theory that a
-- call covers "rider can't find the gate." In practice a call doesn't work
-- when someone can't take a voice call mid-delivery, so this adds a thread per
-- order alongside the existing contact reveal — it doesn't replace it.
--
-- Scope is deliberately customer <-> rider only, the same two parties
-- order_rider_contact()/order_customer_contact() already expose to each other.
-- No restaurant leg.

create table order_messages (
  id bigserial primary key,
  order_id uuid not null references orders(id) on delete cascade,
  sender_id uuid not null references profiles(id),
  body text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index order_messages_order_id_idx on order_messages(order_id, created_at);

alter table order_messages enable row level security;

-- Either party can read the whole thread, with no time cutoff. Unlike a phone
-- number, a message someone already sent or received isn't new PII exposure
-- once the window that let them send it closes, so there's no reason to hide
-- history after delivery the way order_rider_contact() hides a phone number.
create policy "order participants read messages"
  on order_messages for select
  using (
    exists (
      select 1 from orders o
       where o.id = order_messages.order_id
         and (o.customer_id = auth.uid() or o.rider_id = auth.uid())
    )
  );

-- Sending is scoped to the same window as the phone-contact reveal: open once
-- a rider has claimed the order, closed the moment it's handed over or
-- cancelled. Before assignment there's no rider to talk to; after delivery
-- there's nothing left to coordinate.
create policy "order participants send messages"
  on order_messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from orders o
       where o.id = order_messages.order_id
         and (o.customer_id = auth.uid() or o.rider_id = auth.uid())
         and o.delivery_status in ('assigned', 'picked_up')
    )
  );

revoke all on order_messages from public, anon;
grant select, insert on order_messages to authenticated;
grant usage, select on sequence order_messages_id_seq to authenticated;

-- Stream new messages live, same reasoning as orders in migration 005.
alter publication supabase_realtime add table order_messages;
alter table order_messages replica identity full;

-- ============ VERIFY ============
select 'order_messages table exists' as check,
       case when exists (
         select 1 from information_schema.tables
          where table_schema = 'public' and table_name = 'order_messages'
       ) then 'PASS' else 'FAIL' end as result
union all
select 'row level security enabled',
       case when (
         select rowsecurity from pg_tables
          where schemaname = 'public' and tablename = 'order_messages'
       ) then 'PASS' else 'FAIL' end
union all
select 'read + send policies present',
       case when count(*) = 2 then 'PASS'
            else 'FAIL — found ' || count(*) || ' of 2' end
  from pg_policies
 where schemaname = 'public' and tablename = 'order_messages'
union all
select 'streaming over realtime',
       case when exists (
         select 1 from pg_publication_tables
          where pubname = 'supabase_realtime'
            and schemaname = 'public' and tablename = 'order_messages'
       ) then 'PASS' else 'FAIL' end;
