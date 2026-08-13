-- 008 — imagery for restaurants and menu items.
--
-- The customer app was a text list because the data model had no pictures in
-- it. Browsing food you can't see is the wrong experience for the one screen
-- that has to make someone hungry, so the layouts are now image-led.
--
-- Nullable on purpose, and the app draws a generated tile when a row has no
-- image. That means this can ship before a single photo exists and improve
-- one restaurant at a time as they send them in — no big-bang content push,
-- and no half-empty grid in the meantime.
--
-- Plain text URLs rather than a Storage bucket + upload flow. Pointing at
-- files a restaurant already has is the fastest path to a populated app; an
-- upload UI is a feature of its own and can land later without changing
-- these columns.

alter table restaurants
  -- Wide banner behind the restaurant name — roughly 16:9.
  add column if not exists image_url text;

alter table menu_items
  -- Square thumbnail beside the dish. Kept separate from the restaurant
  -- banner because the crops are different and reusing one for the other
  -- always looks wrong.
  add column if not exists image_url text;