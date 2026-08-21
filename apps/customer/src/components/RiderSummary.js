import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@food-dash/theme';
import { distanceMetres } from '../lib/orders';

// The words under the map — and the whole of it on web, where there is no map.
// Shared by RiderMap.native.js and RiderMap.web.js so the two platforms can
// never end up describing the same delivery differently.

/**
 * What the rider is heading for right now.
 *
 * Before pickup that's the restaurant; after it, the customer. Measuring to
 * the wrong end would tell a customer their food is getting further away while
 * the rider rides toward the kitchen.
 *
 * The customer end only exists if they dropped a pin at checkout — orders
 * placed before that, or from the web, have a typed address and nothing else.
 */
function target(order) {
  if (order.deliveryStatus === 'picked_up' && order.dropoffLat != null) {
    return { lat: order.dropoffLat, lng: order.dropoffLng, toCustomer: true };
  }
  if (order.restaurantLat != null) {
    return { lat: order.restaurantLat, lng: order.restaurantLng, toCustomer: false };
  }
  return null;
}

function formatDistance(metres) {
  if (metres < 1000) return `${Math.round(metres / 50) * 50} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}

/**
 * Straight-line distance over an average scooter speed.
 *
 * Not road routing — that needs a paid directions API. Through Cebu traffic,
 * lights and corners, 18km/h is a fair average for a motorbike, and the number
 * is labelled as an estimate rather than dressed up as a promise.
 */
function etaMinutes(metres) {
  return Math.max(1, Math.round((metres / 1000) / 18 * 60));
}

export default function RiderSummary({ order, freshness }) {
  const to = target(order);
  const metres = to ? distanceMetres(freshness.lat, freshness.lng, to.lat, to.lng) : null;

  return (
    <View style={styles.summary}>
      <View style={[styles.badge, freshness.stale && styles.badgeStale]}>
        <Ionicons name="bicycle" size={20} color={colors.white} />
      </View>

      <View style={{ flex: 1 }}>
        {metres != null ? (
          <Text style={styles.title}>
            {to.toCustomer
              ? `Arriving in about ${etaMinutes(metres)} min`
              : `${formatDistance(metres)} from the restaurant`}
          </Text>
        ) : (
          <Text style={styles.title}>Rider is on the move</Text>
        )}

        <Text style={[styles.meta, freshness.stale && styles.stale]}>
          {freshness.label}
          {metres != null && to.toCustomer ? ` · ${formatDistance(metres)} away` : ''}
        </Text>

        {/* Said once, plainly, rather than letting someone wonder why the
            estimate is to a restaurant they aren't waiting at. */}
        {order.deliveryStatus === 'picked_up' && order.dropoffLat == null ? (
          <Text style={styles.noPin}>
            No pin was dropped for this address, so we can't estimate arrival.
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  badge: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.coralDeep,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeStale: { backgroundColor: colors.textMuted },
  title: {
    fontSize: typography.subhead,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
  },
  meta: { marginTop: 2, fontSize: typography.caption, color: colors.textMuted },
  stale: { color: colors.coralDeep },
  noPin: { marginTop: 4, fontSize: typography.caption, color: colors.textMuted },
});
