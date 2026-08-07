import { supabase } from './supabase';

// The restaurant this account owns. RLS lets anyone read restaurants, so the
// owner_id filter is what scopes it — an account with no restaurant gets null.
export async function fetchMyRestaurant(userId) {
  const { data, error } = await supabase
    .from('restaurants')
    .select('id, name, is_open')
    .eq('owner_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function setOpen(restaurantId, isOpen) {
  const { error } = await supabase
    .from('restaurants')
    .update({ is_open: isOpen })
    .eq('id', restaurantId);

  if (error) throw error;
}

function toOrder(row) {
  return {
    id: row.id,
    number: row.order_number,
    status: row.status,
    deliveryStatus: row.delivery_status,
    subtotalCents: row.subtotal_cents,
    payoutCents: row.restaurant_payout_cents,
    dropoff: row.dropoff_address,
    notes: row.notes,
    placedAt: row.created_at,
    items: (row.order_items ?? []).map((i) => ({
      name: i.name_snapshot,
      qty: i.quantity,
      lineTotalCents: i.price_cents_snapshot * i.quantity,
    })),
  };
}

/** Live orders — anything not yet delivered or cancelled. */
export async function fetchOrders(restaurantId) {
  const { data, error } = await supabase
    .from('orders')
    .select(
      'id, order_number, status, delivery_status, subtotal_cents, ' +
      'restaurant_payout_cents, dropoff_address, notes, created_at, ' +
      'order_items(name_snapshot, price_cents_snapshot, quantity)',
    )
    .eq('restaurant_id', restaurantId)
    .not('status', 'in', '("delivered","cancelled")')
    .order('created_at');

  if (error) throw error;
  return data.map(toOrder);
}

export async function advanceOrder(orderId) {
  const { error } = await supabase.rpc('advance_order_status', { p_order_id: orderId });
  if (error) throw error;
}

export async function rejectOrder(orderId, reason) {
  const { error } = await supabase.rpc('cancel_order', {
    p_order_id: orderId,
    p_reason: reason ?? null,
  });
  if (error) throw error;
}

/**
 * Calls back whenever any order for this restaurant changes.
 *
 * Realtime only carries the fact that a row changed, not the joined
 * order_items, so the handler refetches rather than patching state from the
 * payload. Simpler, and never drifts from the database.
 */
export function subscribeToOrders(restaurantId, onChange) {
  const channel = supabase
    .channel(`orders:${restaurantId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `restaurant_id=eq.${restaurantId}`,
      },
      onChange,
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}
