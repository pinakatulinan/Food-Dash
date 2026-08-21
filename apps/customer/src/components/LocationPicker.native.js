import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { colors, browse, spacing, radius, typography } from '@food-dash/theme';

// Drop a pin on where the food actually goes.
//
// A typed address is words; a rider needs a place. Until this existed the app
// stored "McDo Linao" and had no idea where that was, so it could only measure
// a rider against the restaurant — the one point on the trip it had numbers
// for. This is what turns the delivery into two known ends.

// Cebu City, so the map opens somewhere useful rather than in the ocean off
// west Africa, which is where 0,0 is.
const CEBU = { latitude: 10.3157, longitude: 123.8854 };

export default function LocationPicker({ value, onChange }) {
  const [region, setRegion] = useState({
    latitude: value?.lat ?? CEBU.latitude,
    longitude: value?.lng ?? CEBU.longitude,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });

  return (
    <View>
      <View style={styles.mapWrap}>
        <MapView
          style={styles.map}
          initialRegion={region}
          // The pin is fixed to the centre of the screen and the map moves
          // underneath it. Dragging a tiny marker with a thumb that covers it
          // is the worst version of this interaction; moving the map is not.
          onRegionChangeComplete={(r) => {
            setRegion(r);
            onChange({ lat: r.latitude, lng: r.longitude });
          }}
        />
        <View style={styles.centrePin} pointerEvents="none">
          <Ionicons name="location" size={38} color={colors.coralDeep} />
        </View>
      </View>

      <View style={styles.hintRow}>
        <Ionicons name="move-outline" size={16} color={colors.textMuted} />
        <Text style={styles.hint}>
          {value
            ? 'Drag the map to move the pin to your gate or door.'
            : 'Drag the map so the pin sits on your address.'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mapWrap: {
    height: 220,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: browse.sectionBg,
  },
  map: { flex: 1 },
  centrePin: {
    position: 'absolute',
    left: 0, right: 0, top: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    // The point of a pin is its tip, not its middle, so it sits half its own
    // height above centre.
    paddingBottom: 38,
  },
  hintRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginTop: spacing.sm, marginBottom: spacing.md,
  },
  hint: { flex: 1, fontSize: typography.caption, color: colors.textMuted },
});
