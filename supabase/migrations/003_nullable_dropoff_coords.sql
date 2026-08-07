-- 003 — drop-off coordinates are optional.
--
-- Checkout takes a free-text address for the pilot; there's no map picker and
-- no geocoding, so there are no coordinates to store. The rider app hands the
-- address straight to Google Maps as text, which is all a one-barangay pilot
-- needs. Making these NOT NULL would have forced us to invent numbers.
--
-- Add coordinates back as required once there's a real address picker.

alter table orders alter column dropoff_lat drop not null;
alter table orders alter column dropoff_lng drop not null;
