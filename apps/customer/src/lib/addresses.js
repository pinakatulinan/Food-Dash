import { supabase } from './supabase';

// Saved delivery addresses. RLS scopes every one of these to the signed-in
// customer, so none of them filter by user_id — the database does it.

function toAddress(row) {
  return {
    id: row.id,
    label: row.label,
    address: row.address,
    notes: row.notes,
    isDefault: row.is_default,
    // Null for anything saved before migration 015 — those addresses still
    // work as text, and the customer is asked to drop a pin next time.
    lat: row.lat,
    lng: row.lng,
  };
}

const FIELDS = 'id, label, address, notes, is_default, lat, lng';

/** Default first, then newest — the order the checkout list shows them in. */
export async function fetchAddresses() {
  const { data, error } = await supabase
    .from('addresses')
    .select(FIELDS)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data.map(toAddress);
}

/**
 * Saves an address for reuse.
 *
 * The first one a customer saves becomes their default, because a list of one
 * with nothing selected is a pointless extra tap at checkout.
 */
export async function createAddress({ label, address, notes, makeDefault, lat, lng }) {
  const { count, error: countError } = await supabase
    .from('addresses')
    .select('id', { count: 'exact', head: true });

  if (countError) throw countError;

  // user_id is defaulted to auth.uid() by the database (migration 006), so it
  // is deliberately absent here.
  const { data, error } = await supabase
    .from('addresses')
    .insert({
      label: label?.trim() || null,
      address: address.trim(),
      notes: notes?.trim() || null,
      lat: lat ?? null,
      lng: lng ?? null,
      is_default: makeDefault || count === 0,
    })
    .select(FIELDS)
    .single();

  if (error) throw error;
  return toAddress(data);
}

/** Goes through the database function so the one-default-per-customer index
 *  is never transiently violated. See migration 006. */
export async function setDefaultAddress(addressId) {
  const { error } = await supabase.rpc('set_default_address', {
    p_address_id: addressId,
  });
  if (error) throw error;
}

export async function deleteAddress(addressId) {
  const { error } = await supabase.from('addresses').delete().eq('id', addressId);
  if (error) throw error;
}