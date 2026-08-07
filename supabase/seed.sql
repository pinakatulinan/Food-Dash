-- Seed data for local development / pilot demo (Cebu area)
insert into restaurants (id, name, description, address, lat, lng, is_open, opens_at, closes_at, prep_minutes, delivery_fee_cents) values
  ('11111111-1111-1111-1111-111111111111', 'Nang Inday''s Kitchen', 'Home-cooked silog meals', 'Tabunok, Talisay City', 10.2447, 123.8494, true, '07:00', '21:00', 15, 2900),
  ('22222222-2222-2222-2222-222222222222', 'Kape ni Juan', 'Local coffee and snacks', 'Lawaan, Talisay City', 10.2531, 123.8412, true, '06:00', '20:00', 5, 1900),
  ('33333333-3333-3333-3333-333333333333', 'Larsian BBQ', 'Grilled favorites', 'Bulacao, Cebu City', 10.2705, 123.8590, true, '10:00', '22:00', 20, 3500);

insert into menu_items (restaurant_id, category, name, price_cents, sort_order) values
  ('11111111-1111-1111-1111-111111111111', 'Silog meals', 'Sisig silog', 12900, 1),
  ('11111111-1111-1111-1111-111111111111', 'Silog meals', 'Tocilog', 10900, 2),
  ('11111111-1111-1111-1111-111111111111', 'Silog meals', 'Longsilog', 9900, 3),
  ('11111111-1111-1111-1111-111111111111', 'Drinks', 'Mango shake', 7900, 4),
  ('22222222-2222-2222-2222-222222222222', 'Coffee', 'Kapeng barako', 6500, 1),
  ('22222222-2222-2222-2222-222222222222', 'Coffee', 'Iced latte', 9500, 2),
  ('22222222-2222-2222-2222-222222222222', 'Snacks', 'Bibingka', 5500, 3),
  ('33333333-3333-3333-3333-333333333333', 'BBQ', 'Pork BBQ (3 sticks)', 9000, 1),
  ('33333333-3333-3333-3333-333333333333', 'BBQ', 'Chorizo', 4500, 2),
  ('33333333-3333-3333-3333-333333333333', 'Rice', 'Puso (hanging rice)', 1500, 3);
