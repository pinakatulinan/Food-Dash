import { supabase } from './supabase';

/**
 * Places an order through the place_order() database function.
 *
 * Only item ids and quantities are sent — every price is recomputed server
 * side from menu_items. Nothing the client says about money is trusted, so
 * there is deliberately no total in this payload.
 */
const ORDER_FIELDS =
  'id, order_number, status, delivery_status, total_cents, ' +
  'cancellation_reason, created_at, rider_lat, rider_lng, rider_location_at, ' +
  'dropoff_address, dropoff_lat, dropoff_lng, ' +
  // lat/lng so the map has somewhere to anchor: the restaurant is the only
  // point on the trip with real coordinates until checkout gets a map picker.
  'restaurants(name, image_url, lat, lng)';

function toOrder(row) {
  return {
    id: row.id,
    number: row.order_number,
    status: row.status,
    deliveryStatus: row.delivery_status,
    totalCents: row.total_cents,
    cancellationReason: row.cancellation_reason,
    placedAt: row.created_at,
    restaurant: row.restaurants?.name ?? 'Restaurant',
    // Drives the thumbnail in the order list. Null until a restaurant has a
    // photo, which FoodImage handles by drawing a tile instead.
    restaurantImageUrl: row.restaurants?.image_url ?? null,
    restaurantLat: row.restaurants?.lat ?? null,
    restaurantLng: row.restaurants?.lng ?? null,
    riderLat: row.rider_lat,
    riderLng: row.rider_lng,
    riderLocationAt: row.rider_location_at,
    dropoffAddress: row.dropoff_address,
    dropoffLat: row.dropoff_lat,
    dropoffLng: row.dropoff_lng,
  };
}

/**
 * Straight-line distance in metres.
 *
 * Haversine, not road distance — a rider two streets away is "close" and that
 * is the whole question a customer is asking. Routing would need a directions
 * API, money, and a network call per update.
 */
export function distanceMetres(aLat, aLng, bLat, bLng) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * How much to trust the last known position.
 *
 * A marker that stopped moving four minutes ago should say so. Showing a stale
 * dot as though it were live is the one thing that makes live tracking worse
 * than no tracking — the customer plans around it and is wrong.
 */
export function locationFreshness(order) {
  if (!order.riderLat || !order.riderLng || !order.riderLocationAt) return null;

  const ageMs = Date.now() - new Date(order.riderLocationAt).getTime();
  const minutes = Math.floor(ageMs / 60000);

  return {
    lat: order.riderLat,
    lng: order.riderLng,
    stale: minutes >= 2,
    label: minutes < 1 ? 'Updating live' : `Last seen ${minutes} min ago`,
  };
}

// The customer-facing timeline. Two lifecycles run in the database — the
// kitchen's and the rider's — and this is where they collapse into one line a
// customer can read. Lives here so the tracking screen and the order list can
// never describe the same order differently.
export const ORDER_STEPS = [
  'Order placed',
  'Restaurant confirmed',
  'Preparing your food',
  'On the way',
  'Delivered',
];

export function stepFor(order) {
  if (order.deliveryStatus === 'delivered') return 4;
  if (order.deliveryStatus === 'picked_up') return 3;
  if (order.status === 'preparing' || order.status === 'ready_for_pickup') return 2;
  if (order.status === 'confirmed') return 1;
  return 0;
}

export function statusLabel(order) {
  return order.status === 'cancelled' ? 'Cancelled' : ORDER_STEPS[stepFor(order)];
}

export function isFinished(order) {
  return order.status === 'cancelled' || order.deliveryStatus === 'delivered';
}

/**
 * Whether the customer may still call this off.
 *
 * Mirrors the rule inside cancel_order(): once the kitchen accepts, food may
 * already be cooking and it stops being the customer's call. The database is
 * the authority — this only decides whether to offer the button, so a stale
 * screen shows a button that fails loudly rather than one that quietly works
 * when it shouldn't.
 */
export function isCancellable(order) {
  return order.status === 'pending';
}

/** Every order this customer has placed. RLS scopes it to them. */
export async function fetchMyOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_FIELDS)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;
  return data.map(toOrder);
}

export async function fetchOrder(orderId) {
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_FIELDS)
    .eq('id', orderId)
    .single();

  if (error) throw error;
  return toOrder(data);
}

/** Pushes every change to this one order — the live tracking timeline. */
export function subscribeToOrder(orderId, onChange) {
  const channel = supabase
    .channel(`order:${orderId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
      onChange,
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}

/**
 * Who is bringing this order, and how to reach them.
 *
 * profiles is readable only by its owner, so this goes through
 * order_rider_contact() (migration 007), which returns just a name and phone
 * and only while a rider is actually carrying the order. Returns null before
 * assignment and after delivery — both are normal, not errors.
 */
export async function fetchRiderContact(orderId) {
  const { data, error } = await supabase.rpc('order_rider_contact', {
    p_order_id: orderId,
  });

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return { name: row.full_name, phone: row.phone };
}

/**
 * Cancels the order.
 *
 * No reason is collected from customers on purpose: the one case they can
 * cancel in is "changed my mind before the kitchen accepted", and a required
 * free-text box there is friction that produces nothing anyone reads.
 */
export async function cancelOrder(orderId) {
  const { error } = await supabase.rpc('cancel_order', {
    p_order_id: orderId,
    p_reason: null,
  });
  if (error) throw error;
}

export async function placeOrder({ restaurant, cart, address, notes, coords }) {
  const items = Object.values(cart).map(({ item, qty }) => ({
    menu_item_id: item.id,
    quantity: qty,
  }));

  const { data, error } = await supabase.rpc('place_order', {
    p_restaurant_id: restaurant.id,
    p_items: items,
    p_dropoff_address: address.trim(),
    // Null when the customer ordered from the web, where there is no map to
    // pin. place_order() has always accepted these; until 015 nothing sent them.
    p_dropoff_lat: coords?.lat ?? null,
    p_dropoff_lng: coords?.lng ?? null,
    p_notes: notes?.trim() ? notes.trim() : null,
    p_payment_method: 'cash',
  });

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  return {
    id: row.id,
    orderNumber: row.order_number,
    totalCents: row.total_cents,
  };
}
