import { supabase } from './supabase';

// The signed-in customer's own profile row.
//
// RLS scopes profiles to its owner, and schema.sql grants UPDATE on exactly
// two columns — full_name and phone — so there is no way for this file to
// change a role or anything else, however it is called.

/**
 * Loose on purpose.
 *
 * Philippine mobile numbers get written every which way: 09171234567,
 * +639171234567, 0917 123 4567. Rejecting formats a real person actually uses
 * is worse than storing one that needs a human to read it — the number exists
 * to be dialled by a rider, not parsed by us. This only catches a genuinely
 * unusable entry.
 */
export function isUsablePhone(value) {
  return (value ?? '').replace(/\D/g, '').length >= 10;
}

export async function fetchMyProfile() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, phone')
    .single();

  if (error) throw error;
  return { id: data.id, fullName: data.full_name, phone: data.phone };
}

export async function updateMyPhone(userId, phone) {
  const { error } = await supabase
    .from('profiles')
    .update({ phone: phone.trim() })
    .eq('id', userId);

  if (error) throw error;
}
