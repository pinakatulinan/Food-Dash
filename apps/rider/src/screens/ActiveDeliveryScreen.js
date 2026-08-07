import React, { useState } from 'react';
import { View, Text, StyleSheet, Linking } from 'react-native';
import { CoralHeader, HeaderStatusPill, Card, PrimaryButton, ErrorText } from '@kaon/ui';
import { colors, spacing, typography } from '@kaon/theme';
import { formatMoney } from '@kaon/money';
import { advanceDelivery } from '../lib/rider';

// Mirrors the delivery_status enum in the database. 'unassigned' never
// appears here — you only reach this screen by claiming an order.
const STAGE = {
  assigned: {
    label: 'Heading to restaurant',
    cta: 'Picked up — start delivery',
    destination: (o) => o.pickup,
  },
  picked_up: {
    label: 'Delivering to customer',
    cta: 'Mark as delivered',
    destination: (o) => o.dropoff,
  },
};

export default function ActiveDeliveryScreen({ route, navigation }) {
  const { order } = route.params;
  const [status, setStatus] = useState(order.deliveryStatus || 'assigned');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const stage = STAGE[status];

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

  const openMaps = () => {
    const dest = encodeURIComponent(`${stage.destination(order)}, Cebu`);
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${dest}`);
  };

  return (
    <View style={styles.screen}>
      <CoralHeader
        back={{ label: 'Orders', onPress: () => navigation.popToTop() }}
        title={`Order #${order.number}`}
        subtitle={order.restaurant}
      >
        <HeaderStatusPill label={stage?.label ?? 'Delivered'} />
      </CoralHeader>
      <View style={{ padding: spacing.screenPadding, gap: spacing.md }}>
        <Card>
          <Text style={styles.label}>Pickup</Text>
          <Text style={styles.value}>{order.restaurant} — {order.pickup}</Text>
          <Text style={[styles.label, { marginTop: spacing.sm }]}>Drop-off</Text>
          <Text style={styles.value}>{order.dropoff}</Text>
          {order.notes ? (
            <>
              <Text style={[styles.label, { marginTop: spacing.sm }]}>Customer notes</Text>
              <Text style={styles.value}>{order.notes}</Text>
            </>
          ) : null}
          <Text style={[styles.label, { marginTop: spacing.sm }]}>Your payout</Text>
          <Text style={styles.payout}>{formatMoney(order.payoutCents)}</Text>
        </Card>
        <Card>
          <Text style={styles.navHint} onPress={openMaps}>Open route in Google Maps →</Text>
        </Card>

        <ErrorText>{error}</ErrorText>

        {stage?.cta && (
          <PrimaryButton
            label={busy ? 'Updating…' : stage.cta}
            onPress={advance}
            disabled={busy}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  label: { fontSize: typography.pill, color: colors.textMuted },
  value: { fontSize: typography.body, color: colors.textPrimary, marginTop: 2 },
  payout: {
    fontSize: typography.sectionTitle, fontWeight: '500',
    color: colors.coralDeep, marginTop: 2,
  },
  navHint: { fontSize: typography.body, fontWeight: '500', color: colors.tealTextDark },
});
