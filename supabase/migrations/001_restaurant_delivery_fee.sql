-- 001 — restaurants need a delivery fee and a realistic prep time.
--
-- The customer app has always displayed a delivery fee, but it only ever
-- existed in mock data. Flat per restaurant is right for a one-barangay pilot;
-- revisit when you want distance-based pricing (the lat/lng are already there).
--
-- Safe to re-run.

alter table restaurants
  add column if not exists delivery_fee_cents int not null default 2900
    check (delivery_fee_cents >= 0);

-- Match the values the apps were built against, and vary prep time so the
-- displayed ETAs aren't identical for every restaurant.
update restaurants set delivery_fee_cents = 2900, prep_minutes = 15
  where name = 'Nang Inday''s Kitchen';
update restaurants set delivery_fee_cents = 1900, prep_minutes = 5
  where name = 'Kape ni Juan';
update restaurants set delivery_fee_cents = 3500, prep_minutes = 20
  where name = 'Larsian BBQ';
