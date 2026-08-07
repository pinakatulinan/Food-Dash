import { supabase } from './supabase';

// Every rider query lives here. RLS already scopes most of these to the
// signed-in rider, but the explicit filters keep the intent visible.

export async function fetchRiderRecord() {
  // "rider reads self" means this can only ever return your own row.
  const { data, error } = await supabase
    .from('riders')
    .select('id, status, is_online, vehicle_type, plate_number')
    .maybeSingle();

  if (error) throw error;
  return data; // null if this account isn't a rider
}

export async function setOnline(riderId, isOnline) {
  const { error } = await supabase
    .from('riders')
    .update({ is_online: isOnline })
    .eq('id', riderId);

  // The database refuses to put an unapproved rider online, so a constraint
  // violation here is a real answer rather than a bug.
  if (error) throw error;
}

function toOrder(row) {
  return {
    id: row.id,
    number: row.order_number,
    status: row.status,
    deliveryStatus: row.delivery_status,
    dropoff: row.dropoff_address,
    notes: row.notes,
    payoutCents: row.rider_payout_cents,
    restaurant: row.restaurants?.name ?? 'Restaurant',
    pickup: row.restaurants?.address ?? '',
  };
}

const ORDER_FIELDS =
  'id, order_number, status, delivery_status, dropoff_address, notes, ' +
  'rider_payout_cents, restaurants(name, address)';

/** The unclaimed pool. Returns nothing unless you're approved and online. */
export async function fetchAvailableOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_FIELDS)
    .eq('delivery_status', 'unassigned')
    .in('status', ['confirmed', 'preparing', 'ready_for_pickup'])
    .order('created_at');

  if (error) throw error;
  return data.map(toOrder);
}

/** The one delivery a rider is currently on, if any. */
export async function fetchActiveDelivery(riderId) {
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_FIELDS)
    .eq('rider_id', riderId)
    .in('delivery_status', ['assigned', 'picked_up'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? toOrder(data) : null;
}

/**
 * Calls back whenever any order changes. Riders can't filter server-side —
 * an unclaimed order has no rider_id to match on — so this listens broadly
 * and refetches. RLS still decides what the refetch returns.
 */
export function subscribeToOrders(onChange) {
  const channel = supabase
    .channel('rider-orders')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'orders' },
      onChange,
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}

export async function acceptOrder(orderId) {
  const { data, error } = await supabase.rpc('accept_order', { p_order_id: orderId });
  if (error) throw error;
  return toOrder(Array.isArray(data) ? data[0] : data);
}

export async function advanceDelivery(orderId) {
  const { data, error } = await supabase.rpc('advance_delivery', { p_order_id: orderId });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row.delivery_status;
}

/** Delivered payouts, summed for today and the last 7 days. */
export async function fetchEarnings(riderId) {
  const since = new Date();
  since.setDate(since.getDate() - 7);

  const { data, error } = await supabase
    .from('orders')
    .select('rider_payout_cents, delivered_at')
    .eq('rider_id', riderId)
    .eq('delivery_status', 'delivered')
    .gte('delivered_at', since.toISOString());

  if (error) throw error;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  let todayCents = 0;
  let weekCents = 0;
  let trips = 0;

  for (const row of data) {
    weekCents += row.rider_payout_cents;
    if (new Date(row.delivered_at) >= startOfToday) {
      todayCents += row.rider_payout_cents;
      trips += 1;
    }
  }

  return { todayCents, weekCents, trips };
}
