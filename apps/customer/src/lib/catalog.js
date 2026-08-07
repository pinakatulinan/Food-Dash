import { supabase } from './supabase';

// Every query lives here so screens never see snake_case or raw rows. The
// mapping functions are the seam: when a column is renamed, this file changes
// and no screen does.

// Travel time isn't modelled yet — a flat allowance on top of the kitchen's
// own prep estimate. Replace with a real distance calculation once the dropoff
// address is known before checkout.
const TRAVEL_MIN_MINUTES = 10;
const TRAVEL_MAX_MINUTES = 20;

function toRestaurant(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isOpen: row.is_open,
    deliveryFeeCents: row.delivery_fee_cents,
    etaMin: row.prep_minutes + TRAVEL_MIN_MINUTES,
    etaMax: row.prep_minutes + TRAVEL_MAX_MINUTES,
  };
}

function toMenuItem(row) {
  return {
    id: row.id,
    category: row.category,
    name: row.name,
    description: row.description,
    priceCents: row.price_cents,
  };
}

export async function fetchRestaurants() {
  const { data, error } = await supabase
    .from('restaurants')
    .select('id, name, description, is_open, prep_minutes, delivery_fee_cents')
    .order('is_open', { ascending: false })
    .order('name');

  if (error) throw error;
  return data.map(toRestaurant);
}

export async function fetchMenu(restaurantId) {
  const { data, error } = await supabase
    .from('menu_items')
    .select('id, category, name, description, price_cents, sort_order')
    .eq('restaurant_id', restaurantId)
    .eq('is_available', true)
    .order('sort_order');

  if (error) throw error;
  return data.map(toMenuItem);
}
