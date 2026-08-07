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
  'cancellation_reason, created_at, restaurants(name)';

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

export async function placeOrder({ restaurant, cart, address, notes }) {
  const items = Object.values(cart).map(({ item, qty }) => ({
    menu_item_id: item.id,
    quantity: qty,
  }));

  const { data, error } = await supabase.rpc('place_order', {
    p_restaurant_id: restaurant.id,
    p_items: items,
    p_dropoff_address: address.trim(),
    // No map picker yet — the rider app hands the text address to Google Maps.
    p_dropoff_lat: null,
    p_dropoff_lng: null,
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
