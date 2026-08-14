import { supabase } from './supabase';

// Every query lives here so screens never see snake_case or raw rows. The
// mapping functions are the seam: when a column is renamed, this file changes
// and no screen does.

// Travel time isn't modelled yet — a flat allowance on top of the kitchen's
// own prep estimate. Replace with a real distance calculation once the dropoff
// address is known before checkout.
const TRAVEL_MIN_MINUTES = 10;
const TRAVEL_MAX_MINUTES = 20;

/**
 * Whether the kitchen is open at this moment.
 *
 * Two things must be true: the manual switch is on, and the clock is inside
 * today's hours. A restaurant with no hours set has never filled the form in,
 * so the switch is the whole answer — same behaviour it had before hours
 * existed.
 *
 * This uses the device clock, which is fine for deciding what to show. It is
 * NOT the authority: a trigger on orders re-checks against the server clock,
 * so a phone with the wrong time can't order into a closed kitchen. See
 * migration 012.
 */
function openNow(isOpen, hours) {
  if (!isOpen) return false;
  if (!hours || hours.length === 0) return true;

  const now = new Date();
  const today = hours.find((h) => h.weekday === now.getDay());
  const minutes = now.getHours() * 60 + now.getMinutes();
  const toMinutes = (t) => {
    const [h, m] = t.split(':');
    return Number(h) * 60 + Number(m);
  };

  if (today) {
    const opens = toMinutes(today.opens_at);
    const closes = toMinutes(today.closes_at);
    // A session that closes past midnight, e.g. 17:00–02:00.
    if (opens > closes) return minutes >= opens;
    return minutes >= opens && minutes < closes;
  }

  // Closed today by the schedule, but last night's late session may still be
  // running — a BBQ place open till 2am is closed "today" until it shuts.
  const yesterday = hours.find((h) => h.weekday === (now.getDay() + 6) % 7);
  if (yesterday && toMinutes(yesterday.opens_at) > toMinutes(yesterday.closes_at)) {
    return minutes < toMinutes(yesterday.closes_at);
  }

  return false;
}

/** "Opens 8:00am" — so a closed card says when to come back. */
function nextOpening(hours) {
  if (!hours || hours.length === 0) return null;
  const now = new Date();

  for (let ahead = 0; ahead < 7; ahead += 1) {
    const day = (now.getDay() + ahead) % 7;
    const slot = hours.find((h) => h.weekday === day);
    if (!slot) continue;

    const [h, m] = slot.opens_at.split(':');
    if (ahead === 0 && now.getHours() * 60 + now.getMinutes() >= Number(h) * 60 + Number(m)) {
      continue;   // today's opening has already passed
    }

    const when = new Date(now);
    when.setDate(now.getDate() + ahead);
    when.setHours(Number(h), Number(m), 0, 0);

    const time = when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    if (ahead === 0) return `Opens ${time}`;
    if (ahead === 1) return `Opens tomorrow ${time}`;
    return `Opens ${when.toLocaleDateString(undefined, { weekday: 'long' })} ${time}`;
  }
  return null;
}

function toRestaurant(row) {
  const hours = row.restaurant_hours ?? [];
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isOpen: openNow(row.is_open, hours),
    // Only worth telling someone when to come back if the kitchen is shut.
    opensLabel: openNow(row.is_open, hours) ? null : nextOpening(hours),
    imageUrl: row.image_url,
    deliveryFeeCents: row.delivery_fee_cents,
    etaMin: row.prep_minutes + TRAVEL_MIN_MINUTES,
    etaMax: row.prep_minutes + TRAVEL_MAX_MINUTES,
    // Which kinds of food this place sells, from its own menu. Powers the
    // category rail on Home — there is no cuisine field on restaurants, and
    // the menu is a more honest answer than one anyway.
    categories: [...new Set((row.menu_items ?? []).map((m) => m.category))],
  };
}

function toMenuItem(row) {
  return {
    id: row.id,
    category: row.category,
    name: row.name,
    description: row.description,
    imageUrl: row.image_url,
    priceCents: row.price_cents,
  };
}

/**
 * Every restaurant, each carrying the categories it actually serves.
 *
 * The categories come back embedded rather than as a second round trip: the
 * pilot is a handful of restaurants in one barangay, so one query with a small
 * nested select beats two queries and a client-side join. Revisit if the list
 * ever grows past a page.
 */
export async function fetchRestaurants() {
  const { data, error } = await supabase
    .from('restaurants')
    .select(
      'id, name, description, is_open, image_url, prep_minutes, ' +
      'delivery_fee_cents, menu_items(category), ' +
      'restaurant_hours(weekday, opens_at, closes_at)',
    )
    .order('is_open', { ascending: false })
    .order('name');

  if (error) throw error;
  return data.map(toRestaurant);
}

export async function fetchMenu(restaurantId) {
  const { data, error } = await supabase
    .from('menu_items')
    .select('id, category, name, description, image_url, price_cents, sort_order')
    .eq('restaurant_id', restaurantId)
    .eq('is_available', true)
    .order('sort_order');

  if (error) throw error;
  return data.map(toMenuItem);
}