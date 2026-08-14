import { supabase } from './supabase';

// The restaurant this account owns. RLS lets anyone read restaurants, so the
// owner_id filter is what scopes it — an account with no restaurant gets null.
export async function fetchMyRestaurant(userId) {
  const { data, error } = await supabase
    .from('restaurants')
    .select('id, name, is_open, image_url, description, prep_minutes')
    .eq('owner_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Updates the restaurant's own row.
 *
 * Only is_open, image_url, description and prep_minutes are writable — the
 * database revokes every other column from `authenticated` (migration 009), so
 * commission_rate and the name can't be changed from here no matter what this
 * function is asked to send.
 *
 * `.select()` is not optional. Before 009 there was no UPDATE policy at all,
 * so this matched zero rows and Postgres reported success — the toggle looked
 * like it worked until you reloaded. Asking for the row back turns that class
 * of silent failure into a thrown error.
 */
export async function updateRestaurant(restaurantId, patch) {
  const { data, error } = await supabase
    .from('restaurants')
    .update(patch)
    .eq('id', restaurantId)
    .select('id, name, is_open, image_url, description, prep_minutes')
    .single();

  if (error) throw error;
  return data;
}

export async function setOpen(restaurantId, isOpen) {
  return updateRestaurant(restaurantId, { is_open: isOpen });
}

// ============ OPENING HOURS ============
// A row per day the restaurant is open. No row means closed that day, so
// "closed Sundays" is the absence of a row rather than a flag to interpret.

export const WEEKDAYS = [
  { day: 0, label: 'Sunday' },
  { day: 1, label: 'Monday' },
  { day: 2, label: 'Tuesday' },
  { day: 3, label: 'Wednesday' },
  { day: 4, label: 'Thursday' },
  { day: 5, label: 'Friday' },
  { day: 6, label: 'Saturday' },
];

export async function fetchHours(restaurantId) {
  const { data, error } = await supabase
    .from('restaurant_hours')
    .select('weekday, opens_at, closes_at')
    .eq('restaurant_id', restaurantId);

  if (error) throw error;

  // Keyed by weekday so the editor can look a day up without scanning.
  const byDay = {};
  data.forEach((h) => {
    // Postgres returns time as HH:MM:SS; the inputs want HH:MM.
    byDay[h.weekday] = {
      opensAt: h.opens_at.slice(0, 5),
      closesAt: h.closes_at.slice(0, 5),
    };
  });
  return byDay;
}

/**
 * Replaces the whole week in one go.
 *
 * Deleting everything and re-inserting the open days is simpler than diffing,
 * and it makes "closed" impossible to get wrong — a day the restaurant
 * unticked genuinely has no row afterwards, rather than a stale one nobody
 * noticed.
 */
export async function saveHours(restaurantId, byDay) {
  const rows = Object.entries(byDay)
    .filter(([, h]) => h && h.opensAt && h.closesAt)
    .map(([weekday, h]) => ({
      restaurant_id: restaurantId,
      weekday: Number(weekday),
      opens_at: h.opensAt,
      closes_at: h.closesAt,
    }));

  const { error: clearError } = await supabase
    .from('restaurant_hours')
    .delete()
    .eq('restaurant_id', restaurantId);
  if (clearError) throw clearError;

  if (rows.length === 0) return;

  const { error } = await supabase.from('restaurant_hours').insert(rows);
  if (error) throw error;
}

// ============ MENU ============

function toMenuItem(row) {
  return {
    id: row.id,
    category: row.category,
    name: row.name,
    description: row.description,
    priceCents: row.price_cents,
    imageUrl: row.image_url,
    isAvailable: row.is_available,
    sortOrder: row.sort_order,
  };
}

/** The whole menu, sold-out items included — this is the editor, not the shop. */
export async function fetchMenu(restaurantId) {
  const { data, error } = await supabase
    .from('menu_items')
    .select('id, category, name, description, price_cents, image_url, is_available, sort_order')
    .eq('restaurant_id', restaurantId)
    .order('category')
    .order('sort_order');

  if (error) throw error;
  return data.map(toMenuItem);
}

/** Creates or updates one dish. `id` absent means a new one. */
export async function saveMenuItem(restaurantId, item) {
  const row = {
    restaurant_id: restaurantId,
    category: item.category?.trim() || 'Meals',
    name: item.name.trim(),
    description: item.description?.trim() || null,
    price_cents: item.priceCents,
    image_url: item.imageUrl || null,
    is_available: item.isAvailable ?? true,
    sort_order: item.sortOrder ?? 0,
  };

  const query = item.id
    ? supabase.from('menu_items').update(row).eq('id', item.id)
    : supabase.from('menu_items').insert(row);

  const { data, error } = await query.select(
    'id, category, name, description, price_cents, image_url, is_available, sort_order',
  ).single();

  if (error) throw error;
  return toMenuItem(data);
}

/**
 * Taking a dish off the menu hides it rather than deleting it.
 *
 * order_items snapshots the name and price at order time, so an old order
 * survives a deletion — but menu_items.id is still referenced, and a dish that
 * comes back next week should be the same row rather than a new one. Hiding is
 * also reversible by the person who did it, which deleting is not.
 */
export async function setItemAvailable(itemId, isAvailable) {
  const { error } = await supabase
    .from('menu_items')
    .update({ is_available: isAvailable })
    .eq('id', itemId);

  if (error) throw error;
}

/**
 * Uploads a photo and returns its public URL.
 *
 * Stored under <restaurant_id>/... because the storage policies in 009 check
 * the first path segment — that folder IS the permission boundary, so the
 * prefix is not cosmetic.
 */
export async function uploadImage(restaurantId, file) {
  const extension = (file.name.split('.').pop() || 'jpg').toLowerCase();
  // Timestamped rather than named after the dish: a rename shouldn't orphan
  // the photo, and two dishes called "Special" shouldn't collide.
  const path = `${restaurantId}/${Date.now()}.${extension}`;

  const { error } = await supabase.storage
    .from('menu-images')
    .upload(path, file, { cacheControl: '3600', upsert: false });

  if (error) throw error;

  const { data } = supabase.storage.from('menu-images').getPublicUrl(path);
  return data.publicUrl;
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

// ============ HISTORY & TAKINGS ============

/**
 * Finished and unfinished orders since a date — the opposite of fetchOrders(),
 * which deliberately shows only what still needs acting on.
 *
 * Ranged rather than "everything", because this list only grows and a
 * restaurant asking for today's takings shouldn't pull down six months.
 */
export async function fetchHistory(restaurantId, sinceIso) {
  const { data, error } = await supabase
    .from('orders')
    .select(
      'id, order_number, status, delivery_status, subtotal_cents, ' +
      'restaurant_payout_cents, dropoff_address, notes, created_at, ' +
      'order_items(name_snapshot, price_cents_snapshot, quantity)',
    )
    .eq('restaurant_id', restaurantId)
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data.map(toOrder);
}

/**
 * Totals for a set of orders.
 *
 * Cancelled orders are counted but contribute nothing to the money — a
 * cancelled order is not revenue, and a takings figure that quietly includes
 * them is a figure that disagrees with the bank. They're reported separately
 * so the number is explainable rather than just smaller than expected.
 *
 * Pure and separate from the query so it can be checked without a database.
 */
export function summarise(orders) {
  const counted = orders.filter((o) => o.status !== 'cancelled');
  const grossCents = counted.reduce((sum, o) => sum + o.subtotalCents, 0);
  const payoutCents = counted.reduce((sum, o) => sum + o.payoutCents, 0);

  return {
    orders: counted.length,
    cancelled: orders.length - counted.length,
    grossCents,
    payoutCents,
    // Your cut, derived rather than stored: the difference between what the
    // food sold for and what the restaurant is owed.
    commissionCents: grossCents - payoutCents,
    averageCents: counted.length ? Math.round(grossCents / counted.length) : 0,
  };
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
