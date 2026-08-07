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
    restaurant: row.restaurants?.name ?? 'Restaurant',
  };
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
