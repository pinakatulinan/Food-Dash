import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Linking, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  ScreenHeader, Panel, Button, StatusPill, ErrorText, InfoRow,
} from '@food-dash/ui';
import { colors, browse, spacing, typography } from '@food-dash/theme';
import { formatMoney } from '@food-dash/money';
import { advanceDelivery, fetchCustomerContact } from '../lib/rider';
import {
  requestLocationPermission, startTracking, stopTracking,
} from '../lib/location';

// The screen a rider looks at while moving.
//
// Everything here is sized for a glance and a gloved thumb: one action, at the
// bottom, unmissable. The two things a rider actually needs mid-run — where am
// I going, and who do I call — are the two loudest items above it.

const STAGE = {
  assigned: {
    label: 'Heading to restaurant',
    cta: 'Picked up — start delivery',
    icon: 'restaurant-outline',
    destination: (o) => o.pickup,
    coords: (o) => (o.pickupLat != null ? { lat: o.pickupLat, lng: o.pickupLng } : null),
    destinationLabel: 'Pick up from',
  },
  picked_up: {
    label: 'Delivering to customer',
    cta: 'Mark as delivered',
    icon: 'bicycle-outline',
    destination: (o) => o.dropoff,
    coords: (o) => (o.dropoffLat != null ? { lat: o.dropoffLat, lng: o.dropoffLng } : null),
    destinationLabel: 'Deliver to',
  },
};

export default function ActiveDeliveryScreen({ route, navigation }) {
  const { order } = route.params;
  const [status, setStatus] = useState(order.deliveryStatus || 'assigned');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [locationOn, setLocationOn] = useState(true);

  const stage = STAGE[status];

  // Tracking is tied to carrying an order, not to being online, and not to
  // this screen being visible — the whole point is that it survives the rider
  // switching to Google Maps. It stops on handover.
  useEffect(() => {
    let active = true;
    const carrying = status === 'assigned' || status === 'picked_up';

    if (!carrying) { stopTracking(); return undefined; }

    (async () => {
      const { background } = await requestLocationPermission();
      if (!active) return;
      // Declining is allowed. The delivery still works — the customer just
      // sees an address instead of a moving marker — so this reports the
      // consequence rather than blocking the screen.
      if (!background) { setLocationOn(false); return; }
      setLocationOn(await startTracking());
    })();

    return () => { active = false; };
  }, [status]);

  // Stop when the delivery ends, however this screen is left.
  useEffect(() => stopTracking, []);

  // Fetched rather than passed in the order payload, because the database
  // decides who may see this and for how long. A null answer after delivery is
  // the window closing, not a failure.
  useEffect(() => {
    let active = true;
    fetchCustomerContact(order.id)
      .then((c) => { if (active) setCustomer(c); })
      .catch(() => { if (active) setCustomer(null); });
    return () => { active = false; };
  }, [order.id, status]);

  const advance = async () => {
    setBusy(true);
    setError(null);
    try {
      const next = await advanceDelivery(order.id);
      if (next === 'delivered') {
        navigation.popToTop();
      } else {
        setStatus(next);
      }
    } catch (e) {
      // e.g. "The kitchen has not marked this order ready yet."
      setError(e.message);
    }
    setBusy(false);
  };

  /**
   * Navigate to the pin, and only fall back to the typed address without one.
   *
   * These two can disagree badly: a customer can pin their actual house and
   * type the name of a landmark down the road, and the pin is the one that is
   * literally true. Sending the text to Maps meant the rider drove to whatever
   * Google made of the words while the customer watched a marker somewhere
   * else entirely.
   */
  const openMaps = () => {
    const pin = stage?.coords(order);
    const dest = pin
      ? `${pin.lat},${pin.lng}`
      : encodeURIComponent(`${stage.destination(order)}, Cebu`);
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${dest}`);
  };

  const call = () => Linking.openURL(`tel:${customer.phone}`);

  return (
    <View style={styles.screen}>
      <ScreenHeader
        size="large"
        onBack={() => navigation.popToTop()}
        title={`Order #${order.number}`}
        subtitle={order.restaurant}
      >
        <StatusPill label={stage?.label ?? 'Delivered'} />
      </ScreenHeader>

      <ScrollView contentContainerStyle={styles.body}>
        {/* Where to go, biggest thing on the screen after the action. Which
            address it is changes with the stage, so a rider never has to work
            out which of two addresses applies right now. */}
        <Panel>
          <Text style={styles.destLabel}>{stage?.destinationLabel ?? 'Delivered to'}</Text>
          <Text style={styles.destValue}>{stage?.destination(order) ?? order.dropoff}</Text>
          {stage?.coords(order) ? (
            <Text style={styles.pinNote}>
              Customer dropped a pin — Maps will take you to the exact spot,
              which may differ from the address above.
            </Text>
          ) : (
            <Text style={styles.pinNote}>
              No pin for this one. Maps will search the address as written.
            </Text>
          )}
          <Button
            label="Open in Google Maps"
            icon="navigate"
            variant="ghost"
            size="large"
            onPress={openMaps}
          />
        </Panel>

        {customer ? (
          <Panel>
            <InfoRow label="Customer" value={customer.name} icon="person-outline" />
            {/* Chat handles most of this now; call stays as the fallback for
                a rider who can't stop to type. */}
            <View style={styles.messageBtn}>
              <Button
                label="Message customer"
                icon="chatbubble-outline"
                variant="ghost"
                size="large"
                onPress={() => navigation.navigate('Chat', {
                  orderId: order.id, orderNumber: order.number, peerName: customer.name,
                })}
              />
            </View>
            {customer.phone ? (
              <Button
                label={`Call ${customer.phone}`}
                icon="call"
                variant="ghost"
                size="large"
                onPress={call}
              />
            ) : (
              <Text style={styles.noPhone}>No number on file for this customer.</Text>
            )}
          </Panel>
        ) : null}

        {order.notes ? (
          <Panel style={styles.notes}>
            <InfoRow label="Customer notes" value={order.notes} icon="chatbubble-outline" />
          </Panel>
        ) : null}

        <Panel>
          <View style={styles.payoutRow}>
            <View>
              <Text style={styles.destLabel}>You earn</Text>
              <Text style={styles.payout}>{formatMoney(order.payoutCents)}</Text>
            </View>
            <Ionicons name="cash-outline" size={26} color={colors.coralDeep} />
          </View>
        </Panel>

        {!locationOn ? (
          <Panel style={styles.locationOff}>
            <InfoRow
              label="Location sharing is off"
              value="The customer can't see where you are. Turn on location for Food-Dash in your phone settings."
              icon="location-outline"
            />
          </Panel>
        ) : null}

        <ErrorText>{error}</ErrorText>
      </ScrollView>

      {/* Pinned rather than scrolled to: the one thing a rider needs to press
          must never be below the fold. */}
      {stage?.cta && (
        <View style={styles.actionBar}>
          <Button
            label={busy ? 'Updating…' : stage.cta}
            icon={stage.icon}
            size="large"
            onPress={advance}
            disabled={busy}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: browse.pageBg },
  body: { padding: spacing.screenPadding, gap: spacing.md, paddingBottom: spacing.xl },
  destLabel: { fontSize: typography.pill, color: colors.textMuted },
  destValue: {
    marginTop: 4,
    marginBottom: spacing.md,
    fontSize: typography.title,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
    lineHeight: 28,
  },
  pinNote: {
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
    fontSize: typography.caption,
    color: colors.textMuted,
    lineHeight: 17,
  },
  noPhone: { marginTop: spacing.sm, fontSize: typography.caption, color: colors.textMuted },
  messageBtn: { marginBottom: spacing.sm },
  notes: { backgroundColor: colors.mintPastel },
  locationOff: { backgroundColor: '#FDF0EA' },
  payoutRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  payout: {
    marginTop: 2,
    fontSize: typography.hero,
    fontWeight: typography.bold,
    color: colors.coralDeep,
  },
  actionBar: {
    padding: spacing.screenPadding,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    backgroundColor: browse.pageBg,
  },
});
