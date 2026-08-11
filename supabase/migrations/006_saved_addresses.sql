-- 006 — saved delivery addresses.
--
-- Checkout took a free-text address every single time, so a customer retyped
-- their own street on every order. Addresses live in the database rather than
-- on the device so they survive a reinstall and follow the customer to a new
-- phone — the same reason orders don't live in AsyncStorage.
--
-- NOTE ON NUMBERING: an earlier, since-removed 006 added push notification
-- tables. The two share nothing but the number. If that one was applied to a
-- live project, drop its objects before running this file.

create table if not exists addresses (
  id         uuid primary key default gen_random_uuid(),
  -- Defaulted so the client never has to send it. The RLS check below still
  -- enforces it — the default just removes a round trip and one way to get
  -- an insert wrong.
  user_id    uuid not null references profiles(id) on delete cascade
             default auth.uid(),
  label      text,                          -- "Home", "Office" — optional
  address    text not null,
  notes      text,                          -- landmark, gate colour, call on arrival
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_addresses_user on addresses (user_id);

-- At most one default per customer, enforced here rather than trusting
-- whichever screen happens to be setting it.
create unique index if not exists idx_addresses_one_default
  on addresses (user_id) where is_default;

alter table addresses enable row level security;

-- A customer may only ever see or touch their own addresses. There is no
-- reason for any other role to read this table at all: the address a rider
-- needs is snapshotted onto the order at checkout.
drop policy if exists "own addresses" on addresses;
create policy "own addresses" on addresses for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============ SWITCHING THE DEFAULT ============
-- Clearing the old default and setting the new one must happen inside one
-- transaction, or the unique index above rejects the instant two rows claim
-- it. Runs as the caller — not security definer — so RLS still scopes both
-- statements to their own rows.
create or replace function set_default_address(p_address_id uuid)
returns void
language plpgsql
set search_path = public
as $$
begin
  update addresses
     set is_default = false
   where user_id = auth.uid() and is_default and id <> p_address_id;

  update addresses
     set is_default = true
   where id = p_address_id and user_id = auth.uid();

  if not found then
    raise exception 'Address not found.';
  end if;
end;
$$;

revoke all on function set_default_address(uuid) from public, anon;
grant execute on function set_default_address(uuid) to authenticated;
