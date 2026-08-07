-- 005 — publish order changes over realtime.
--
-- Supabase only streams tables that are in the supabase_realtime publication.
-- Without this the dashboard and rider app subscribe successfully and then
-- silently never receive anything, which looks like a client bug.
--
-- RLS still applies to realtime, so a restaurant only receives events for its
-- own orders and a rider only for orders it can already see.

alter publication supabase_realtime add table orders;

-- Lets subscribers see which columns actually changed, and gives DELETE events
-- a usable payload rather than just a primary key.
alter table orders replica identity full;
