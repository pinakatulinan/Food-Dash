import { supabase } from './supabase';

// Admin operations.
//
// Every one of these is a database function, not a table write. The client is
// deliberately not allowed to change a rider's status or a restaurant's owner
// directly — schema.sql and migration 009 revoke exactly those columns — so
// the permission check lives in the database and applies no matter what this
// file does. Hiding the tab is presentation; the function is the boundary.

/** Whether the signed-in account may see any of this. */
export async function isAdmin() {
  const { data, error } = await supabase.rpc('is_admin');
  if (error) return false;   // Not an admin, or not signed in. Same outcome.
  return data === true;
}

export async function fetchPeople() {
  const { data, error } = await supabase.rpc('admin_list_people');
  if (error) throw error;

  return data.map((p) => ({
    id: p.id,
    email: p.email,
    fullName: p.full_name,
    role: p.role,
    phone: p.phone,
    riderStatus: p.rider_status,
    isOnline: p.is_online,
    createdAt: p.created_at,
  }));
}

/** 'approved' lets them work; 'suspended' takes them off the road immediately. */
export async function setRiderStatus(riderId, status) {
  const { error } = await supabase.rpc('admin_set_rider_status', {
    p_rider_id: riderId,
    p_status: status,
  });
  if (error) throw error;
}

export async function fetchRestaurants() {
  const { data, error } = await supabase.rpc('admin_list_restaurants');
  if (error) throw error;

  return data.map((r) => ({
    id: r.id,
    name: r.name,
    ownerId: r.owner_id,
    ownerEmail: r.owner_email,
    isOpen: r.is_open,
    commissionRate: r.commission_rate,
    deliveryFeeCents: r.delivery_fee_cents,
  }));
}

export async function linkOwner(restaurantId, email) {
  const { error } = await supabase.rpc('admin_link_restaurant_owner', {
    p_restaurant_id: restaurantId,
    p_email: email,
  });
  if (error) throw error;
}

export async function createRestaurant({ name, address, commissionRate, deliveryFeeCents }) {
  const { data, error } = await supabase.rpc('admin_create_restaurant', {
    p_name: name,
    p_address: address,
    p_commission_rate: commissionRate,
    p_delivery_fee_cents: deliveryFeeCents,
  });
  if (error) throw error;
  return data;
}
