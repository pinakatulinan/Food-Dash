import React from 'react';
import { View, StyleSheet } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { colors, browse, spacing, radius } from '@food-dash/theme';
import RiderSummary from './RiderSummary';

/**
 * Fits the camera around everything that matters.
 *
 * Centring on the rider alone means the customer can see a moving dot with no
 * idea whether it's coming toward them. Showing both ends is the whole point.
 */
function regionFor(points) {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const pad = 0.008;   // keeps markers off the edges

  return {
    latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
    longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2,
    latitudeDelta: Math.max(Math.max(...lats) - Math.min(...lats) + pad, 0.01),
    longitudeDelta: Math.max(Math.max(...lngs) - Math.min(...lngs) + pad, 0.01),
  };
}

export default function RiderMap({ order, freshness }) {
  const rider = { lat: freshness.lat, lng: freshness.lng };
  const points = [rider];

  const restaurant = order.restaurantLat != null
    ? { lat: order.restaurantLat, lng: order.restaurantLng } : null;
  const dropoff = order.dropoffLat != null
    ? { lat: order.dropoffLat, lng: order.dropoffLng } : null;

  if (restaurant) points.push(restaurant);
  if (dropoff) points.push(dropoff);

  return (
    <View>
      <View style={styles.mapWrap}>
        <MapView
          style={styles.map}
          // initialRegion, not region: driving the camera on every position
          // update would fight the customer every time they pan or zoom.
          initialRegion={regionFor(points)}
          showsUserLocation={false}
          toolbarEnabled={false}
        >
          {/* A motorbike, not a map pin — at a glance you want to know it's
              your rider, not just that something is there. */}
          <Marker
            coordinate={{ latitude: rider.lat, longitude: rider.lng }}
            title="Your rider"
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={[styles.riderMarker, freshness.stale && styles.riderStale]}>
              <Ionicons name="bicycle" size={20} color={colors.white} />
            </View>
          </Marker>

          {restaurant ? (
            <Marker
              coordinate={{ latitude: restaurant.lat, longitude: restaurant.lng }}
              title={order.restaurant}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={styles.placeMarker}>
                <Ionicons name="restaurant" size={14} color={colors.white} />
              </View>
            </Marker>
          ) : null}

          {dropoff ? (
            <Marker
              coordinate={{ latitude: dropoff.lat, longitude: dropoff.lng }}
              title="Your address"
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={styles.homeMarker}>
                <Ionicons name="home" size={14} color={colors.white} />
              </View>
            </Marker>
          ) : null}
        </MapView>
      </View>
      <RiderSummary order={order} freshness={freshness} />
    </View>
  );
}

const styles = StyleSheet.create({
  mapWrap: {
    height: 240,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
    backgroundColor: browse.sectionBg,
  },
  map: { flex: 1 },
  riderMarker: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.coralDeep,
    borderWidth: 3, borderColor: colors.white,
    alignItems: 'center', justifyContent: 'center',
  },
  // Grey when the position is minutes old, so a frozen marker doesn't read as
  // a live one.
  riderStale: { backgroundColor: colors.textMuted },
  placeMarker: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.tealTextDark,
    borderWidth: 2, borderColor: colors.white,
    alignItems: 'center', justifyContent: 'center',
  },
  homeMarker: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.textPrimary,
    borderWidth: 2, borderColor: colors.white,
    alignItems: 'center', justifyContent: 'center',
  },
});
